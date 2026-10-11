import { prisma } from "../db";
import { NotFoundError } from "../http";
import { normalizePhone } from "../phone";
import { saveTicketLink, contactCafeLink, cancelLink } from "../wa";
import { wibDateTime, todayWib } from "../time";
import { ReservationStatus, Prisma } from "@prisma/client";

export async function getTicketByToken(
  token: string,
  now: Date = new Date(),
  appUrl = process.env.APP_URL || "http://localhost:3000",
  db = prisma
) {
  const reservation = await db.reservation.findUnique({
    where: { ticketToken: token },
    include: {
      room: true,
      items: true,
    },
  });

  if (!reservation) {
    throw new NotFoundError("Tiket reservasi tidak ditemukan.");
  }

  const setting = await db.setting.findUnique({ where: { id: 1 } });
  const cafeWhatsapp = setting?.cafeWhatsapp ?? "";

  // Check lazy expiry for pending payment
  const isExpired =
    reservation.status === "PENDING_PAYMENT" &&
    reservation.holdExpiresAt.getTime() <= now.getTime();

  const effectiveStatus = isExpired ? "EXPIRED" : reservation.status;

  const snapToken =
    effectiveStatus === "PENDING_PAYMENT" ? reservation.snapToken : null;

  const saveLink = saveTicketLink({
    code: reservation.code,
    roomName: reservation.room.name,
    start: reservation.startAt,
    end: reservation.endAt,
    guestCount: reservation.guestCount,
    ticketToken: reservation.ticketToken,
    appUrl,
  });

  const contactLink = contactCafeLink({
    cafeWhatsapp,
    customerName: reservation.customerName,
    code: reservation.code,
    start: reservation.startAt,
    end: reservation.endAt,
  });

  return {
    code: reservation.code,
    status: effectiveStatus,
    room: {
      id: reservation.room.id,
      name: reservation.room.name,
      location: reservation.room.location,
    },
    startAt: reservation.startAt,
    endAt: reservation.endAt,
    guestCount: reservation.guestCount,
    customerName: reservation.customerName,
    items: reservation.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      option: item.option,
      kind: item.kind,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    totalAmount: reservation.totalAmount,
    servingTime: reservation.servingTime,
    servingAt: reservation.servingAt,
    kitchenNote: reservation.kitchenNote,
    holdExpiresAt: reservation.holdExpiresAt,
    snapToken,
    snapRedirectUrl: effectiveStatus === "PENDING_PAYMENT" ? reservation.snapRedirectUrl : null,
    wa: {
      saveLink,
      contactCafeLink: contactLink,
    },
  };
}

export async function lookupTicket(
  input: { code: string; phone: string },
  db = prisma
) {
  let normalizedPhone = "";
  try {
    normalizedPhone = normalizePhone(input.phone);
  } catch {
    throw new NotFoundError(
      "Reservasi tidak ditemukan. Pastikan kode booking dan nomor WhatsApp sudah sesuai."
    );
  }

  const reservation = await db.reservation.findFirst({
    where: {
      code: input.code.trim().toUpperCase(),
      customerPhone: normalizedPhone,
    },
  });

  if (!reservation) {
    throw new NotFoundError(
      "Reservasi tidak ditemukan. Pastikan kode booking dan nomor WhatsApp sudah sesuai."
    );
  }

  return { ticketToken: reservation.ticketToken };
}

export async function getAdminReservations(
  filter: { date?: string | null; status?: ReservationStatus | null } = {},
  now: Date = new Date(),
  db = prisma
) {
  const whereClause: Record<string, unknown> = {};

  if (filter.status) {
    whereClause.status = filter.status;
  }

  // Filter tanggal: default hari ini (WIB) jika tidak diset dan bukan 'all'
  const dateStr = filter.date === undefined ? todayWib(now) : filter.date;
  if (dateStr && dateStr !== "all") {
    const startOfDay = wibDateTime(dateStr, "00:00");
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    whereClause.startAt = { gte: startOfDay, lt: endOfDay };
  }

  return db.reservation.findMany({
    where: whereClause,
    include: {
      room: true,
      _count: { select: { items: true } },
    },
    orderBy: { startAt: "asc" },
  });
}

export async function getAdminReservationDetail(
  id: string,
  db = prisma
) {
  const reservation = await db.reservation.findUnique({
    where: { id },
    include: {
      room: true,
      items: {
        include: { product: true },
      },
    },
  });

  if (!reservation) {
    throw new NotFoundError("Reservasi tidak ditemukan.");
  }

  const logs = await db.activityLog.findMany({
    where: { reservationId: id },
    orderBy: { createdAt: "asc" },
  });

  let waCancelLink: string | null = null;
  if (reservation.status === "CANCELLED" && reservation.cancelledBy) {
    waCancelLink = cancelLink({
      by: reservation.cancelledBy,
      customerPhone: reservation.customerPhone,
      customerName: reservation.customerName,
      code: reservation.code,
      roomName: reservation.room.name,
      start: reservation.startAt,
      end: reservation.endAt,
      reason: reservation.cancelReason ?? undefined,
      totalAmount: reservation.totalAmount,
      refundAmount: reservation.refundAmount,
    });
  }

  return {
    ...reservation,
    logs,
    wa: {
      cancelLink: waCancelLink,
    },
  };
}

export async function getNeedsActionReservations(
  now: Date = new Date(),
  db = prisma
) {
  // (a) Reservasi PENDING_PAYMENT / CONFIRMED di masa depan yang beririsan dengan blokir
  const activeBlocks = await db.roomBlock.findMany({
    where: {
      OR: [{ endAt: null }, { endAt: { gt: now } }],
    },
  });

  type ReservationWithRoom = Prisma.ReservationGetPayload<{ include: { room: true } }>;
  const conflictingReservations: ReservationWithRoom[] = [];

  for (const block of activeBlocks) {
    const resList = await db.reservation.findMany({
      where: {
        roomId: block.roomId,
        OR: [
          { status: "CONFIRMED" },
          { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
        ],
        startAt: { gte: now, ...(block.endAt ? { lt: block.endAt } : {}) },
        blockEndAt: { gt: block.startAt },
      },
      include: { room: true },
    });
    conflictingReservations.push(...resList);
  }

  // (b) Reservasi CANCELLED dengan refundStatus=PENDING
  const pendingRefunds = await db.reservation.findMany({
    where: {
      status: "CANCELLED",
      refundStatus: "PENDING",
    },
    include: { room: true },
    orderBy: { cancelledAt: "desc" },
  });

  // Gabungkan dan deduplikasi
  const seenIds = new Set<string>();
  const combined = [];

  for (const r of [...conflictingReservations, ...pendingRefunds]) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      combined.push(r);
    }
  }

  return combined;
}

export async function getCheckInSummaryByCode(code: string, db = prisma) {
  const reservation = await db.reservation.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: {
      room: true,
      items: true,
    },
  });

  if (!reservation) {
    throw new NotFoundError("Reservasi dengan kode tersebut tidak ditemukan.");
  }

  return reservation;
}

