import { prisma } from "../db";
import { NotFoundError } from "../http";
import { normalizePhone } from "../phone";
import { saveTicketLink, contactCafeLink } from "../wa";

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
  const cafeWhatsapp = setting?.cafeWhatsapp || "6281234567890";

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
    checkInUrl: `${appUrl}/admin/check-in/${reservation.code}`,
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
