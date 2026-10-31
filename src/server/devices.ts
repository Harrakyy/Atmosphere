// K-35: HP kasir (SetorPantau) membaca notifikasi DANA lalu mengirimkannya ke sini supaya reservasi otomatis Lunas.
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { CODE_ALPHABET } from "./codes";
import { AppError, InvalidTransitionError, NotFoundError, UnauthorizedError } from "./http";
import { markPaid } from "./reservations/transitions";

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const PAIRING_MINUTES = 10;
const CLOCK_SKEW_MS = 5 * MIN; // jam HP bisa sedikit beda dengan server

export type QrisMatchResult = "MATCHED" | "ALREADY_PAID" | "LATE_SLOT_TAKEN" | "NO_MATCH";

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const deviceSelect = { id: true, name: true, pairingCode: true, pairingExpiresAt: true, pairedAt: true, lastSeenAt: true } as const;

export async function createPairingCode(actorId: string, now: Date = new Date(), db = prisma) {
  // Kode lama yang tidak pernah dipakai dibuang supaya daftar tidak menumpuk
  await db.device.deleteMany({ where: { tokenHash: null, revokedAt: null, pairingExpiresAt: { lt: now } } });
  const pairingCode = Array.from({ length: 8 }, () => CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)]).join("");
  return db.device.create({
    data: {
      name: "HP Kasir",
      pairingCode,
      pairingExpiresAt: new Date(now.getTime() + PAIRING_MINUTES * MIN),
      createdById: actorId,
    },
    select: deviceSelect,
  });
}

export function listDevices(now: Date = new Date(), db = prisma) {
  return db.device.findMany({
    where: { revokedAt: null, OR: [{ tokenHash: { not: null } }, { pairingExpiresAt: { gt: now } }] },
    select: deviceSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeDevice(id: string, actorId: string, now: Date = new Date(), db = prisma) {
  const { count } = await db.device.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: now, tokenHash: null, pairingCode: null },
  });
  if (count === 0) throw new NotFoundError("Perangkat tidak ditemukan.");
  await db.activityLog.create({ data: { actorId, action: "DEVICE_REVOKED", detail: { deviceId: id } } });
}

export async function pairDevice(code: string, name: string | undefined, now: Date = new Date(), db = prisma) {
  const token = crypto.randomBytes(32).toString("base64url");
  const deviceName = name || "HP Kasir";
  // updateMany dengan syarat kode masih berlaku: dua HP yang memakai kode sama bersamaan, hanya satu yang menang
  const { count } = await db.device.updateMany({
    where: { pairingCode: code, pairingExpiresAt: { gt: now }, tokenHash: null, revokedAt: null },
    data: { tokenHash: hashToken(token), name: deviceName, pairedAt: now, lastSeenAt: now, pairingCode: null },
  });
  if (count === 0) {
    throw new AppError("PAIRING_INVALID", "Kode pairing salah atau sudah kedaluwarsa. Buat kode baru di halaman admin.", 400);
  }
  const device = await db.device.findUniqueOrThrow({ where: { tokenHash: hashToken(token) }, select: { id: true, name: true } });
  await db.activityLog.create({ data: { action: "DEVICE_PAIRED", detail: { deviceId: device.id, name: deviceName } } });
  return { token, device };
}

export async function requireDevice(request: Request, now: Date = new Date(), db = prisma) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const device = token ? await db.device.findFirst({ where: { tokenHash: hashToken(token), revokedAt: null } }) : null;
  // 401 dibaca SetorPantau sebagai "akses dicabut", lalu HP minta pairing ulang
  if (!device) throw new UnauthorizedError("Perangkat tidak terdaftar atau aksesnya sudah dicabut.");
  await db.device.update({ where: { id: device.id }, data: { lastSeenAt: now } });
  return device;
}

async function respond(result: string, reservationId: string | null, db: typeof prisma) {
  const res = reservationId ? await db.reservation.findUnique({ where: { id: reservationId }, select: { code: true } }) : null;
  return { result: result as QrisMatchResult, reservationCode: res?.code ?? null };
}

export async function recordQrisNotification(
  deviceId: string,
  input: { notifId: string; amount: number; time: number; text: string },
  now: Date = new Date(),
  db = prisma
) {
  const existing = await db.qrisNotification.findUnique({ where: { deviceId_notifId: { deviceId, notifId: input.notifId } } });
  if (existing) return respond(existing.result, existing.reservationId, db);

  const paidAt = new Date(input.time);
  if (input.time > now.getTime() + CLOCK_SKEW_MS || input.time < now.getTime() - 7 * DAY) {
    throw new AppError("NOTIFICATION_TIME", "Waktu notifikasi tidak masuk akal. Cek jam di HP kasir.", 400);
  }
  // Uang harus masuk setelah pesanan dibuat, supaya transfer lama bernominal sama tidak ikut cocok
  const createdBefore = new Date(input.time + CLOCK_SKEW_MS);

  let result: QrisMatchResult = "NO_MATCH";
  let reservationId: string | null = null;

  // R-Q3 menjamin payAmount unik di antara PENDING_PAYMENT dan EXPIRED ≤ 24 jam
  const candidate = await db.reservation.findFirst({
    where: {
      payAmount: input.amount,
      createdAt: { lte: createdBefore },
      OR: [{ status: "PENDING_PAYMENT" }, { status: "EXPIRED", holdExpiresAt: { gte: new Date(input.time - DAY) } }],
    },
    orderBy: { createdAt: "desc" },
  });

  if (candidate) {
    reservationId = candidate.id;
    try {
      const updated = await markPaid(candidate.id, null, paidAt, db);
      result = updated.status === "CANCELLED" ? "LATE_SLOT_TAKEN" : "MATCHED";
    } catch (err) {
      if (!(err instanceof InvalidTransitionError)) throw err;
      result = "ALREADY_PAID"; // admin menekan Tandai Lunas bersamaan
    }
  } else {
    // Admin sudah Tandai Lunas manual sebelum notifikasi sampai (misalnya HP sempat offline)
    const paid = await db.reservation.findFirst({
      where: {
        payAmount: input.amount,
        createdAt: { lte: createdBefore },
        paidAt: { gte: new Date(input.time - DAY) },
        status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED"] },
      },
      orderBy: { paidAt: "desc" },
    });
    if (paid) {
      result = "ALREADY_PAID";
      reservationId = paid.id;
    }
  }

  try {
    await db.qrisNotification.create({
      data: { deviceId, notifId: input.notifId, amount: input.amount, paidAt, text: input.text, result, reservationId },
    });
  } catch (err) {
    // Notif yang sama dikirim dua kali bersamaan: pakai hasil yang tersimpan lebih dulu
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    const first = await db.qrisNotification.findUniqueOrThrow({ where: { deviceId_notifId: { deviceId, notifId: input.notifId } } });
    return respond(first.result, first.reservationId, db);
  }
  if (result === "MATCHED") {
    await db.activityLog.create({
      data: { reservationId, action: "PAYMENT_AUTO_MATCHED", detail: { deviceId, amount: input.amount } },
    });
  }
  return respond(result, reservationId, db);
}
