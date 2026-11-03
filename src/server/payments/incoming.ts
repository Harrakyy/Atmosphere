import { Prisma, IncomingResult } from "@prisma/client";
import { prisma } from "../db";
import { AppError, InvalidTransitionError, NotFoundError } from "../http";
import { markPaid } from "../reservations/transitions";

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const CLOCK_SKEW_MS = 5 * MIN; // jam HP dan server boleh selisih sedikit
const PAID = ["CONFIRMED", "CHECKED_IN", "COMPLETED"] as const;

export interface IncomingInput {
  notifId: string;
  amount: number;
  time: number; // ms, waktu notifikasi muncul di HP
  text: string;
}

// Protokol Setor §2: matched | unmatched | duplicate + label untuk transaksi di HP
type SetorResult = "matched" | "unmatched" | "duplicate";
const SETOR_RESULT: Record<IncomingResult, SetorResult> = {
  MATCHED: "matched",
  LATE_SLOT_TAKEN: "matched", // uang memang untuk booking itu; admin mengurus refund dari Perlu Tindakan
  ALREADY_PAID: "unmatched", // kemungkinan customer bayar dobel → admin perlu cek (K-42)
  NO_MATCH: "unmatched",
  DISMISSED: "unmatched",
};

async function toResponse(result: IncomingResult, reservationId: string | null, replay: boolean, db = prisma) {
  const r = reservationId
    ? await db.reservation.findUnique({ where: { id: reservationId }, select: { code: true, customerName: true } })
    : null;
  const label = !r
    ? null
    : result === "ALREADY_PAID"
      ? `${r.code} · bayar dobel?`
      : result === "LATE_SLOT_TAKEN"
        ? `${r.code} · telat, refund`
        : `${r.code} · ${r.customerName}`;
  return { result: replay ? ("duplicate" as SetorResult) : SETOR_RESULT[result], label, reservationCode: r?.code ?? null };
}

/**
 * Notifikasi "Pembayaran Masuk" dari HP kasir → cocokkan nominal unik (R-Q3) → otomatis Lunas.
 * Hanya reservasi yang dibuat SEBELUM notifikasi muncul yang bisa cocok, jadi laporan lama
 * yang dikirim ulang tidak bisa melunasi reservasi baru dengan nominal kebetulan sama.
 */
const TWIN_MS = 2 * 60 * 1000;

export async function handleIncomingPayment(
  device: { id: string; name: string },
  input: IncomingInput,
  now: Date = new Date(),
  db = prisma
) {
  const existing = await db.incomingPayment.findUnique({
    where: { deviceId_notifId: { deviceId: device.id, notifId: input.notifId } },
    include: { device: false },
  });
  if (existing) return toResponse(existing.result, existing.reservationId, true, db);

  // Dua HP Setor membaca DANA yang sama: notifId beda (waktu notif tiap HP beda), nominal sama dalam ±2 menit
  const twin = await db.incomingPayment.findFirst({
    where: {
      deviceId: { not: device.id },
      amount: input.amount,
      notifiedAt: { gte: new Date(input.time - TWIN_MS), lte: new Date(input.time + TWIN_MS) },
    },
  });
  if (twin) return toResponse(twin.result, twin.reservationId, true, db);

  const notifiedAt = new Date(input.time);
  if (Number.isNaN(notifiedAt.getTime()) || notifiedAt.getTime() > now.getTime() + CLOCK_SKEW_MS || notifiedAt.getTime() < now.getTime() - 7 * DAY) {
    throw new AppError("VALIDATION_ERROR", "Waktu notifikasi tidak masuk akal. Periksa jam di HP kasir.", 400);
  }

  const base = { payAmount: input.amount, createdAt: { lte: new Date(notifiedAt.getTime() + CLOCK_SKEW_MS) } };
  const recent = new Date(notifiedAt.getTime() - DAY);
  const pick = (where: Prisma.ReservationWhereInput) =>
    db.reservation.findFirst({ where: { ...base, ...where }, orderBy: { createdAt: "desc" } });

  const waiting = (await pick({ status: "PENDING_PAYMENT" })) ?? (await pick({ status: "EXPIRED", holdExpiresAt: { gte: recent } }));

  let result: IncomingResult = "NO_MATCH";
  let reservation = waiting;
  if (waiting) {
    try {
      const after = await markPaid(waiting.id, null, now, db);
      result = after.status === "CONFIRMED" ? "MATCHED" : "LATE_SLOT_TAKEN";
    } catch (err) {
      // Laporan bersamaan untuk reservasi yang sama: yang kalah melihat statusnya sudah berubah
      if (!(err instanceof InvalidTransitionError)) throw err;
      result = "ALREADY_PAID";
    }
  } else {
    reservation = await pick({ status: { in: [...PAID] }, paidAt: { gte: recent } });
    if (reservation) result = "ALREADY_PAID";
  }

  try {
    await db.incomingPayment.create({
      data: {
        deviceId: device.id,
        notifId: input.notifId,
        amount: input.amount,
        notifiedAt,
        text: input.text,
        result,
        reservationId: reservation?.id ?? null,
      },
    });
  } catch (err) {
    // Notifikasi yang sama datang bersamaan dari antrian HP: pakai hasil yang sudah tersimpan
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return handleIncomingPayment(device, input, now, db);
    }
    throw err;
  }

  if (reservation) {
    await db.activityLog.create({
      data: {
        reservationId: reservation.id,
        action: "PAYMENT_REPORTED_BY_DEVICE",
        detail: { device: device.name, amount: input.amount, result },
      },
    });
  }
  return toResponse(result, reservation?.id ?? null, false, db);
}

// Uang yang perlu dicek admin: tanpa pesanan, atau kemungkinan bayar dobel (K-42)
export async function listUnmatchedPayments(now: Date = new Date(), db = prisma) {
  const rows = await db.incomingPayment.findMany({
    where: { result: { in: ["NO_MATCH", "ALREADY_PAID"] }, createdAt: { gte: new Date(now.getTime() - 14 * DAY) } },
    select: { id: true, amount: true, notifiedAt: true, text: true, result: true, reservationId: true, device: { select: { name: true } } },
    orderBy: { notifiedAt: "desc" },
  });
  const ids = rows.map((r) => r.reservationId).filter((x): x is string => !!x);
  const codes = new Map(
    (await db.reservation.findMany({ where: { id: { in: ids } }, select: { id: true, code: true } })).map((r) => [r.id, r.code])
  );
  return rows.map(({ reservationId, ...r }) => ({ ...r, possibleDoublePaymentOf: reservationId ? codes.get(reservationId) ?? null : null }));
}

export async function dismissIncomingPayment(id: string, adminId: string, db = prisma) {
  const { count } = await db.incomingPayment.updateMany({ where: { id, result: { in: ["NO_MATCH", "ALREADY_PAID"] } }, data: { result: "DISMISSED" } });
  if (count === 0) throw new NotFoundError("Pembayaran tidak ditemukan atau sudah dicek.");
  await db.activityLog.create({ data: { actorId: adminId, action: "UNMATCHED_PAYMENT_DISMISSED", detail: { incomingPaymentId: id } } });
}
