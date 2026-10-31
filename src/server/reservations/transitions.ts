import { prisma } from "../db";
import {
  InvalidTransitionError,
  NotFoundError,
  SlotTakenError,
  TimeRuleError,
  RoomUnavailableError,
} from "../http";
import { validateSchedule } from "../time-rules";
import { todayWib } from "../time";
import { CancelledBy, Prisma, ReservationStatus } from "@prisma/client";

type Db = Pick<typeof prisma, "reservation">;

async function findOrThrow(db: Db, id: string) {
  const res = await db.reservation.findUnique({ where: { id } });
  if (!res) throw new NotFoundError("Reservasi tidak ditemukan.");
  return res;
}

// Update hanya kalau status belum berubah sejak dibaca, supaya request bersamaan tidak transisi dua kali
async function updateIfStatus(
  db: Db,
  id: string,
  from: ReservationStatus,
  data: Prisma.ReservationUncheckedUpdateManyInput
) {
  const { count } = await db.reservation.updateMany({ where: { id, status: from }, data });
  if (count === 0) {
    throw new InvalidTransitionError("Status reservasi sudah berubah. Muat ulang halaman.");
  }
  return db.reservation.findUniqueOrThrow({ where: { id } });
}

export async function confirmReservation(
  reservationId: string,
  payment: { paidAt?: Date; paymentType?: string },
  actorId: string | null = null,
  db = prisma
) {
  const res = await findOrThrow(db, reservationId);

  if (res.status !== "PENDING_PAYMENT" && res.status !== "EXPIRED") {
    throw new InvalidTransitionError(
      `Status tidak dapat diubah ke CONFIRMED dari status ${res.status}.`
    );
  }

  const updated = await updateIfStatus(db, reservationId, res.status, {
      status: "CONFIRMED",
      paidAt: payment.paidAt ?? new Date(),
      paymentType: payment.paymentType ?? "unknown",
    });

  await db.activityLog.create({
    data: {
      actorId,
      reservationId,
      action: "PAYMENT_CONFIRMED",
      detail: {
        paymentType: payment.paymentType,
        totalAmount: updated.totalAmount,
      },
    },
  });

  return updated;
}

export async function expireReservation(
  reservationId: string,
  actorId: string | null = null,
  db = prisma
) {
  const res = await findOrThrow(db, reservationId);

  if (res.status !== "PENDING_PAYMENT") {
    throw new InvalidTransitionError(
      `Status tidak dapat diubah ke EXPIRED dari status ${res.status}.`
    );
  }

  const updated = await updateIfStatus(db, reservationId, res.status, { status: "EXPIRED" });

  await db.activityLog.create({
    data: {
      actorId,
      reservationId,
      action: "RESERVATION_EXPIRED",
    },
  });

  return updated;
}

// Admin sudah memastikan uang masuk (Fase 1), atau listener notifikasi mencocokkan nominal (Fase 2)
export async function markPaid(
  reservationId: string,
  actorId: string | null,
  now: Date = new Date(),
  db = prisma
) {
  const payment = { paidAt: now, paymentType: "QRIS" };
  try {
    return await confirmReservation(reservationId, payment, actorId, db);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (!msg.includes("23P01") && !msg.includes("reservation_no_overlap")) throw err;
    // Bayar terlambat dan slotnya sudah diambil orang lain: uang dikembalikan penuh
    const cancelled = await cancelReservation(
      reservationId,
      { by: "SYSTEM", reason: "Slot sudah terisi saat pembayaran diterima terlambat" },
      actorId,
      now,
      db
    );
    await db.activityLog.create({
      data: { actorId, reservationId, action: "LATE_PAYMENT_SLOT_TAKEN" },
    });
    return cancelled;
  }
}

// Admin tidak menemukan uang masuk: slot dilepas, klaim dihapus supaya keluar dari Perlu Tindakan
export async function rejectPayment(reservationId: string, actorId: string, db = prisma) {
  const res = await findOrThrow(db, reservationId);
  // EXPIRED ikut boleh: klaim yang hold-nya sudah habis tetap muncul di Perlu Tindakan sampai ditolak
  if (res.status !== "PENDING_PAYMENT" && res.status !== "EXPIRED") {
    throw new InvalidTransitionError(`Hanya reservasi yang menunggu pembayaran yang bisa ditolak (status saat ini: ${res.status}).`);
  }
  const updated = await updateIfStatus(db, reservationId, res.status, {
    status: "EXPIRED",
    paymentClaimedAt: null,
  });
  await db.activityLog.create({
    data: { actorId, reservationId, action: "PAYMENT_REJECTED", detail: { payAmount: res.payAmount } },
  });
  return updated;
}

// R-Q4: customer menyatakan sudah membayar → hold diperpanjang supaya admin sempat mengecek
export async function claimPayment(ticketToken: string, now: Date = new Date(), db = prisma) {
  const res = await db.reservation.findUnique({ where: { ticketToken } });
  if (!res) throw new NotFoundError("Tiket reservasi tidak ditemukan.");
  if (res.status !== "PENDING_PAYMENT" || res.holdExpiresAt <= now) {
    throw new InvalidTransitionError("Reservasi ini tidak sedang menunggu pembayaran.");
  }
  if (res.paymentClaimedAt) return res;

  const setting = await db.setting.findUnique({ where: { id: 1 } });
  const extended = new Date(now.getTime() + (setting?.claimHoldMinutes ?? 120) * 60 * 1000);
  const holdExpiresAt = extended > res.holdExpiresAt ? extended : res.holdExpiresAt;

  const updated = await updateIfStatus(db, res.id, "PENDING_PAYMENT", {
    paymentClaimedAt: now,
    holdExpiresAt,
  });
  await db.activityLog.create({
    data: { reservationId: res.id, action: "PAYMENT_CLAIMED", detail: { payAmount: res.payAmount } },
  });
  return updated;
}

export async function checkInReservation(
  reservationId: string,
  actorId: string,
  now: Date = new Date(),
  db = prisma
) {
  const res = await findOrThrow(db, reservationId);

  if (res.status !== "CONFIRMED") {
    throw new InvalidTransitionError(
      `Check-in hanya dapat dilakukan untuk reservasi berstatus CONFIRMED (status saat ini: ${res.status}).`
    );
  }

  // Syarat: Tanggal hari ini (WIB) = tanggal reservasi
  const today = todayWib(now);
  const resDate = todayWib(res.startAt);
  if (today !== resDate) {
    throw new InvalidTransitionError(
      `Check-in hanya dapat dilakukan pada hari-H reservasi (tanggal reservasi: ${resDate}, hari ini: ${today}).`
    );
  }

  const updated = await updateIfStatus(db, reservationId, res.status, {
      status: "CHECKED_IN",
      checkedInAt: now,
    });

  await db.activityLog.create({
    data: {
      actorId,
      reservationId,
      action: "CHECKED_IN",
    },
  });

  return updated;
}

export async function completeReservation(
  reservationId: string,
  actorId: string,
  now: Date = new Date(),
  db = prisma
) {
  const res = await findOrThrow(db, reservationId);

  if (res.status !== "CHECKED_IN") {
    throw new InvalidTransitionError(
      `Selesai hanya dapat dilakukan untuk reservasi berstatus CHECKED_IN (status saat ini: ${res.status}).`
    );
  }

  const updated = await updateIfStatus(db, reservationId, res.status, {
      status: "COMPLETED",
      completedAt: now,
    });

  await db.activityLog.create({
    data: {
      actorId,
      reservationId,
      action: "RESERVATION_COMPLETED",
    },
  });

  return updated;
}

export async function noShowReservation(
  reservationId: string,
  actorId: string,
  now: Date = new Date(),
  db = prisma
) {
  const res = await findOrThrow(db, reservationId);

  if (res.status !== "CONFIRMED") {
    throw new InvalidTransitionError(
      `No-show hanya dapat dilakukan untuk reservasi berstatus CONFIRMED (status saat ini: ${res.status}).`
    );
  }

  // Syarat: Sekarang >= startAt
  if (now.getTime() < res.startAt.getTime()) {
    throw new InvalidTransitionError(
      "No-show baru dapat ditandai setelah jam mulai reservasi tiba."
    );
  }

  const updated = await updateIfStatus(db, reservationId, res.status, { status: "NO_SHOW" });

  await db.activityLog.create({
    data: {
      actorId,
      reservationId,
      action: "MARKED_NO_SHOW",
    },
  });

  return updated;
}

export async function cancelReservation(
  reservationId: string,
  input: {
    by: CancelledBy;
    reason?: string;
    refundAmount?: number;
  },
  actorId: string | null = null,
  now: Date = new Date(),
  db = prisma
) {
  const res = await findOrThrow(db, reservationId);

  // §4: admin hanya membatalkan CONFIRMED; EXPIRED → CANCELLED khusus SYSTEM (pembayaran terlambat)
  const allowedFrom = input.by === "SYSTEM" ? "EXPIRED" : "CONFIRMED";
  if (res.status !== allowedFrom) {
    throw new InvalidTransitionError(
      `Pembatalan tidak valid untuk status ${res.status}.`
    );
  }

  let finalRefundAmount = 0;
  // R-Q5: refund dihitung dari uang yang benar-benar diterima (payAmount), bukan totalAmount
  if (input.by === "CAFE" || input.by === "SYSTEM") {
    finalRefundAmount = res.payAmount;
  } else {
    // CUSTOMER: refund diisi manual oleh admin (0..payAmount)
    finalRefundAmount = input.refundAmount ?? 0;
    if (finalRefundAmount < 0 || finalRefundAmount > res.payAmount) {
      throw new InvalidTransitionError(
        `Nominal refund harus antara 0 dan ${res.payAmount}.`
      );
    }
  }

  const refundStatus = finalRefundAmount > 0 ? "PENDING" : "NONE";

  const updated = await updateIfStatus(db, reservationId, res.status, {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledBy: input.by,
      cancelReason: input.reason || null,
      refundAmount: finalRefundAmount,
      refundStatus,
    });

  await db.activityLog.create({
    data: {
      actorId,
      reservationId,
      action: "RESERVATION_CANCELLED",
      detail: {
        by: input.by,
        reason: input.reason,
        refundAmount: finalRefundAmount,
        refundStatus,
      },
    },
  });

  return updated;
}

export async function markRefundDone(
  reservationId: string,
  input: { note?: string } = {},
  actorId: string,
  db = prisma
) {
  const res = await findOrThrow(db, reservationId);

  if (res.refundStatus !== "PENDING") {
    throw new InvalidTransitionError(
      `Refund hanya dapat ditandai selesai jika status refund adalah PENDING (status saat ini: ${res.refundStatus}).`
    );
  }

  const { count } = await db.reservation.updateMany({
    where: { id: reservationId, refundStatus: "PENDING" },
    data: { refundStatus: "DONE", refundNote: input.note || null },
  });
  if (count === 0) throw new InvalidTransitionError("Refund sudah ditandai selesai.");
  const updated = await db.reservation.findUniqueOrThrow({ where: { id: reservationId } });

  await db.activityLog.create({
    data: {
      actorId,
      reservationId,
      action: "REFUND_DONE",
      detail: { note: input.note },
    },
  });

  return updated;
}

export async function rescheduleReservation(
  reservationId: string,
  input: {
    roomId: string;
    date: string;
    start: string;
    end: string;
  },
  actorId: string,
  now: Date = new Date(),
  db = prisma
) {
  const res = await findOrThrow(db, reservationId);

  if (res.status !== "CONFIRMED") {
    throw new InvalidTransitionError(
      `Reschedule hanya dapat dilakukan untuk reservasi berstatus CONFIRMED (status saat ini: ${res.status}).`
    );
  }

  const setting = await db.setting.findUnique({ where: { id: 1 } });
  // Reschedule mengabaikan lead time cutoff (R-T4), hanya cek R-T1..R-T3 dan R-T5
  const sched = validateSchedule(
    { date: input.date, start: input.start, end: input.end },
    { ...setting, skipLeadCutoff: true }, // bypass lead cutoff R-T4
    now
  );

  if (!sched.ok) {
    throw new TimeRuleError(sched.message, { rule: sched.rule });
  }

  const targetRoom = await db.room.findUnique({ where: { id: input.roomId } });
  if (!targetRoom || targetRoom.isArchived) {
    throw new RoomUnavailableError("Ruangan tidak ditemukan atau sudah tidak aktif.");
  }

  if (res.guestCount < targetRoom.minGuests || res.guestCount > targetRoom.maxGuests) {
    throw new RoomUnavailableError(
      `Jumlah tamu (${res.guestCount}) tidak sesuai kapasitas ruangan (${targetRoom.minGuests}–${targetRoom.maxGuests}).`
    );
  }

  try {
    return await db.$transaction(async (tx) => {
      // Row lock room
      await tx.$queryRawUnsafe(`SELECT 1 FROM "Room" WHERE id = $1 FOR UPDATE`, input.roomId);

      // Lazy expiry sama seperti create, supaya hold kedaluwarsa tidak memicu 409 palsu
      await tx.reservation.updateMany({
        where: { roomId: input.roomId, status: "PENDING_PAYMENT", holdExpiresAt: { lte: now } },
        data: { status: "EXPIRED" },
      });

      // Cek blokir
      const blocks = await tx.roomBlock.findMany({
        where: {
          roomId: input.roomId,
          startAt: { lt: sched.endAt },
          OR: [{ endAt: null }, { endAt: { gt: sched.startAt } }],
        },
      });
      if (blocks.length > 0) {
        throw new RoomUnavailableError("Ruangan diblokir pada rentang waktu tersebut.");
      }

      // Update jadwal reservasi
      let servingAt = res.servingAt;
      if (res.servingTime === "CUSTOM" && res.servingAt) {
        const offset = res.servingAt.getTime() - res.startAt.getTime();
        const shifted = new Date(sched.startAt.getTime() + offset);
        servingAt = shifted >= sched.startAt && shifted < sched.endAt ? shifted : sched.startAt;
      }

      const updated = await updateIfStatus(tx, reservationId, "CONFIRMED", {
        roomId: input.roomId,
        startAt: sched.startAt,
        endAt: sched.endAt,
        blockEndAt: sched.blockEndAt,
        servingAt,
      });

      await tx.activityLog.create({
        data: {
          actorId,
          reservationId,
          action: "RESERVATION_RESCHEDULED",
          detail: {
            oldRoomId: res.roomId,
            newRoomId: input.roomId,
            oldStart: res.startAt,
            newStart: sched.startAt,
          },
        },
      });

      return updated;
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message.includes("23P01") || err.message.includes("reservation_no_overlap")) {
        throw new SlotTakenError("Slot pada ruangan dan jam tersebut sudah terisi.");
      }
    }
    throw err;
  }
}
