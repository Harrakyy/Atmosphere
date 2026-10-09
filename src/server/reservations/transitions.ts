import { prisma } from "../db";
import {
  InvalidTransitionError,
  SlotTakenError,
  TimeRuleError,
  RoomUnavailableError,
} from "../http";
import { validateSchedule } from "../time-rules";
import { todayWib } from "../time";
import { CancelledBy } from "@prisma/client";

export async function confirmReservation(
  reservationId: string,
  payment: { paidAt?: Date; paymentType?: string },
  actorId: string | null = null,
  db = prisma
) {
  const res = await db.reservation.findUnique({ where: { id: reservationId } });
  if (!res) throw new InvalidTransitionError("Reservasi tidak ditemukan.");

  if (res.status !== "PENDING_PAYMENT" && res.status !== "EXPIRED") {
    throw new InvalidTransitionError(
      `Status tidak dapat diubah ke CONFIRMED dari status ${res.status}.`
    );
  }

  const updated = await db.reservation.update({
    where: { id: reservationId },
    data: {
      status: "CONFIRMED",
      paidAt: payment.paidAt ?? new Date(),
      paymentType: payment.paymentType ?? "unknown",
    },
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
  const res = await db.reservation.findUnique({ where: { id: reservationId } });
  if (!res) throw new InvalidTransitionError("Reservasi tidak ditemukan.");

  if (res.status !== "PENDING_PAYMENT") {
    throw new InvalidTransitionError(
      `Status tidak dapat diubah ke EXPIRED dari status ${res.status}.`
    );
  }

  const updated = await db.reservation.update({
    where: { id: reservationId },
    data: { status: "EXPIRED" },
  });

  await db.activityLog.create({
    data: {
      actorId,
      reservationId,
      action: "RESERVATION_EXPIRED",
    },
  });

  return updated;
}

export async function checkInReservation(
  reservationId: string,
  actorId: string,
  now: Date = new Date(),
  db = prisma
) {
  const res = await db.reservation.findUnique({ where: { id: reservationId } });
  if (!res) throw new InvalidTransitionError("Reservasi tidak ditemukan.");

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

  const updated = await db.reservation.update({
    where: { id: reservationId },
    data: {
      status: "CHECKED_IN",
      checkedInAt: now,
    },
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
  const res = await db.reservation.findUnique({ where: { id: reservationId } });
  if (!res) throw new InvalidTransitionError("Reservasi tidak ditemukan.");

  if (res.status !== "CHECKED_IN") {
    throw new InvalidTransitionError(
      `Selesai hanya dapat dilakukan untuk reservasi berstatus CHECKED_IN (status saat ini: ${res.status}).`
    );
  }

  const updated = await db.reservation.update({
    where: { id: reservationId },
    data: {
      status: "COMPLETED",
      completedAt: now,
    },
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
  const res = await db.reservation.findUnique({ where: { id: reservationId } });
  if (!res) throw new InvalidTransitionError("Reservasi tidak ditemukan.");

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

  const updated = await db.reservation.update({
    where: { id: reservationId },
    data: { status: "NO_SHOW" },
  });

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
  const res = await db.reservation.findUnique({ where: { id: reservationId } });
  if (!res) throw new InvalidTransitionError("Reservasi tidak ditemukan.");

  if (res.status !== "CONFIRMED" && res.status !== "EXPIRED") {
    throw new InvalidTransitionError(
      `Pembatalan tidak valid untuk status ${res.status}.`
    );
  }

  let finalRefundAmount = 0;
  if (input.by === "CAFE" || input.by === "SYSTEM") {
    // Refund penuh
    finalRefundAmount = res.totalAmount;
  } else {
    // CUSTOMER: refund diisi manual oleh admin (0..total)
    finalRefundAmount = input.refundAmount ?? 0;
    if (finalRefundAmount < 0 || finalRefundAmount > res.totalAmount) {
      throw new InvalidTransitionError(
        `Nominal refund harus antara 0 dan ${res.totalAmount}.`
      );
    }
  }

  const refundStatus = finalRefundAmount > 0 ? "PENDING" : "NONE";

  const updated = await db.reservation.update({
    where: { id: reservationId },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledBy: input.by,
      cancelReason: input.reason || null,
      refundAmount: finalRefundAmount,
      refundStatus,
    },
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
  const res = await db.reservation.findUnique({ where: { id: reservationId } });
  if (!res) throw new InvalidTransitionError("Reservasi tidak ditemukan.");

  if (res.refundStatus !== "PENDING") {
    throw new InvalidTransitionError(
      `Refund hanya dapat ditandai selesai jika status refund adalah PENDING (status saat ini: ${res.refundStatus}).`
    );
  }

  const updated = await db.reservation.update({
    where: { id: reservationId },
    data: {
      refundStatus: "DONE",
      refundNote: input.note || null,
    },
  });

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
  const res = await db.reservation.findUnique({ where: { id: reservationId } });
  if (!res) throw new InvalidTransitionError("Reservasi tidak ditemukan.");

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

      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          roomId: input.roomId,
          startAt: sched.startAt,
          endAt: sched.endAt,
          blockEndAt: sched.blockEndAt,
          servingAt,
        },
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
