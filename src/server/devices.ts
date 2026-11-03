import crypto from "node:crypto";
import { prisma } from "./db";
import { AppError, NotFoundError, UnauthorizedError } from "./http";
import { validBand, type Band } from "./payment-band";
import { getSettings } from "./settings";

// Protokol Setor §1: identitas usaha dan jalur nominal dikirim saat pairing
const BUSINESS = { name: "Atmosphere Cafe", type: "cafe" } as const;

// K-35: HP kasir (app Setor) dipasangkan dengan kode sekali pakai, lalu memakai token pribadi.
// Token dan kode hanya disimpan sebagai sha256, jadi kebocoran database tidak membocorkan aksesnya.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const PAIRING_TTL_MS = 10 * 60 * 1000;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const randomCode = (len: number) => Array.from({ length: len }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");

export async function createPairingCode(adminId: string, now: Date = new Date(), db = prisma) {
  const code = randomCode(8);
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS);
  await db.pairingCode.create({ data: { codeHash: sha256(code), createdById: adminId, expiresAt } });
  return { code, expiresAt };
}

export async function pairDevice(input: { code: string; name: string; band?: unknown }, now: Date = new Date(), db = prisma) {
  const name = input.name.trim().slice(0, 40) || "HP Kasir";
  // Kode boleh diketik dengan spasi/tanda hubung (mis. "K7Q2-M9XA")
  const code = input.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const pairing = await db.pairingCode.findUnique({ where: { codeHash: sha256(code) } });
  if (!pairing || pairing.usedAt || pairing.expiresAt <= now) {
    throw new AppError("PAIRING_INVALID", "Kode pairing salah atau sudah kedaluwarsa. Buat kode baru dari halaman admin.", 400);
  }
  const token = crypto.randomBytes(32).toString("base64url");
  await getSettings(db); // pastikan baris Setting ada sebelum rentang ditulis
  return db.$transaction(async (tx) => {
    // Kode yang sama dipakai dua HP bersamaan: hanya yang pertama menang
    const { count } = await tx.pairingCode.updateMany({ where: { id: pairing.id, usedAt: null }, data: { usedAt: now } });
    if (count === 0) throw new AppError("PAIRING_INVALID", "Kode pairing sudah dipakai.", 400);
    const device = await tx.paymentDevice.create({
      data: { name, tokenHash: sha256(token), createdById: pairing.createdById },
      select: { id: true, name: true },
    });
    // Rentang dari Setor dipakai untuk reservasi baru; yang sudah menunggu tetap cocok dengan nominalnya
    const s = await tx.setting.update({ where: { id: 1 }, data: validBand(input.band) ? { bandMin: input.band.min, bandMax: input.band.max } : {} });
    return { token, device, business: BUSINESS, band: { min: s.bandMin, max: s.bandMax } };
  });
}

export async function authenticateDevice(token: string, now: Date = new Date(), db = prisma) {
  const device = token ? await db.paymentDevice.findUnique({ where: { tokenHash: sha256(token) } }) : null;
  if (!device || device.revokedAt) {
    throw new UnauthorizedError("Perangkat tidak dikenal atau aksesnya sudah dicabut. Hubungkan ulang dari halaman admin.");
  }
  await db.paymentDevice.update({ where: { id: device.id }, data: { lastSeenAt: now } });
  return { id: device.id, name: device.name };
}

export const listDevices = (db = prisma) =>
  db.paymentDevice.findMany({
    select: { id: true, name: true, createdAt: true, lastSeenAt: true, revokedAt: true },
    orderBy: { createdAt: "desc" },
  });

export async function revokeDevice(id: string, adminId: string, now: Date = new Date(), db = prisma) {
  const { count } = await db.paymentDevice.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } });
  if (count === 0) throw new NotFoundError("Perangkat tidak ditemukan atau sudah dicabut.");
  await db.activityLog.create({ data: { actorId: adminId, action: "DEVICE_REVOKED", detail: { deviceId: id } } });
}

/** Protokol Setor §5: pemilik mengubah rentang di app Setor. */
export async function setBand(band: unknown, db = prisma): Promise<Band> {
  if (!validBand(band)) throw new AppError("VALIDATION_ERROR", "Rentang harus 001–999, minimal 10 angka.", 400);
  await getSettings(db);
  const s = await db.setting.update({ where: { id: 1 }, data: { bandMin: band.min, bandMax: band.max } });
  return { min: s.bandMin, max: s.bandMax };
}

const LABEL: Record<string, string> = { MATCHED: "matched", LATE_SLOT_TAKEN: "matched" };

/** Protokol Setor §6: laporan 90 hari terakhir, untuk Setor yang dipasang ulang / HP baru. */
export async function deviceHistory(now: Date = new Date(), db = prisma) {
  const rows = await db.incomingPayment.findMany({
    where: { notifiedAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } },
    orderBy: { notifiedAt: "desc" },
    take: 2000,
    distinct: ["notifId"],
  });
  const ids = rows.map((r) => r.reservationId).filter((x): x is string => !!x);
  const codes = new Map((await db.reservation.findMany({ where: { id: { in: ids } }, select: { id: true, code: true } })).map((r) => [r.id, r.code]));
  return {
    items: rows.map((r) => ({
      notifId: r.notifId,
      amount: r.amount,
      time: r.notifiedAt.getTime(),
      text: r.text,
      result: LABEL[r.result] ?? "unmatched",
      label: r.reservationId && codes.has(r.reservationId) ? `Booking ${codes.get(r.reservationId)}` : null,
    })),
  };
}
