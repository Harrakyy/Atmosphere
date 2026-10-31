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

const toResponse = (result: IncomingResult, reservationCode: string | null) => ({ result, reservationCode });

/**
 * Notifikasi "Pembayaran Masuk" dari HP kasir → cocokkan nominal unik (R-Q3) → otomatis Lunas.
 * Hanya reservasi yang dibuat SEBELUM notifikasi muncul yang bisa cocok, jadi laporan lama
 * yang dikirim ulang tidak bisa melunasi reservasi baru dengan nominal kebetulan sama.
 */
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
  if (existing) return toResponse(existing.result, await codeOf(existing.reservationId, db));

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
  return toResponse(result, reservation?.code ?? null);
}

async function codeOf(reservationId: string | null, db = prisma) {
  if (!reservationId) return null;
  return (await db.reservation.findUnique({ where: { id: reservationId }, select: { code: true } }))?.code ?? null;
}

export const listUnmatchedPayments = (now: Date = new Date(), db = prisma) =>
  db.incomingPayment.findMany({
    where: { result: "NO_MATCH", createdAt: { gte: new Date(now.getTime() - 14 * DAY) } },
    select: { id: true, amount: true, notifiedAt: true, text: true, device: { select: { name: true } } },
    orderBy: { notifiedAt: "desc" },
  });

export async function dismissIncomingPayment(id: string, adminId: string, db = prisma) {
  const { count } = await db.incomingPayment.updateMany({ where: { id, result: "NO_MATCH" }, data: { result: "DISMISSED" } });
  if (count === 0) throw new NotFoundError("Pembayaran tidak ditemukan atau sudah dicek.");
  await db.activityLog.create({ data: { actorId: adminId, action: "UNMATCHED_PAYMENT_DISMISSED", detail: { incomingPaymentId: id } } });
}
