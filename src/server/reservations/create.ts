import { prisma } from "../db";
import { PaymentGateway } from "../payments/gateway";
import { fakeGateway } from "../payments/fake";
import { validateSchedule } from "../time-rules";
import { validateCart, CartItemInput, ProductWithCategory } from "../cart";
import { normalizePhone } from "../phone";
import { generateCode, generateTicketToken } from "../codes";
import { enabledPayments } from "../pricing";
import {
  AppError,
  SlotTakenError,
  TimeRuleError,
  CartRuleError,
  RoomUnavailableError,
  PaymentGatewayError,
} from "../http";
import { ServingTime, Reservation } from "@prisma/client";

export interface CreateReservationInput {
  roomId: string;
  date: string;
  start: string;
  end: string;
  guestCount: number;
  items: CartItemInput[];
  servingTime: "ON_ARRIVAL" | "AFTER_30_MIN" | "CUSTOM";
  servingAt?: string | Date | null;
  kitchenNote?: string | null;
  customer: {
    name: string;
    phone: string;
    email?: string | null;
  };
}

export interface CreateReservationResult {
  code: string;
  ticketToken: string;
  totalAmount: number;
  holdExpiresAt: Date;
  snapToken: string;
  snapRedirectUrl: string;
}

export async function createReservation(
  input: CreateReservationInput,
  deps: {
    gateway?: PaymentGateway;
    now?: Date;
    db?: typeof prisma;
  } = {}
): Promise<CreateReservationResult> {
  const db = deps.db ?? prisma;
  const gateway = deps.gateway ?? fakeGateway;
  const now = deps.now ?? new Date();

  // 1. Validasi Input Customer (R-D1 - R-D5)
  const customerName = input.customer.name?.trim();
  if (!customerName || customerName.length < 2 || customerName.length > 80) {
    throw new CartRuleError("Nama pemesan harus antara 2 dan 80 karakter.");
  }

  const customerPhone = normalizePhone(input.customer.phone);

  let customerEmail: string | null = null;
  if (input.customer.email) {
    const emailTrim = input.customer.email.trim();
    if (emailTrim.length > 0) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
        throw new CartRuleError("Format email tidak valid.");
      }
      customerEmail = emailTrim;
    }
  }

  const kitchenNote = input.kitchenNote?.trim() || null;
  if (kitchenNote && kitchenNote.length > 300) {
    throw new CartRuleError("Catatan dapur maksimal 300 karakter.");
  }

  // 2. Setting & Validasi Jadwal (R-T1 - R-T6)
  const setting = await db.setting.findUnique({ where: { id: 1 } });
  const sched = validateSchedule(
    { date: input.date, start: input.start, end: input.end },
    setting ?? {},
    now
  );
  if (!sched.ok) {
    throw new TimeRuleError(sched.message, { rule: sched.rule });
  }

  const { startAt, endAt, blockEndAt } = sched;

  // R-D4: Waktu penyajian
  let servingAtDate: Date | null = null;
  if (input.servingTime === "CUSTOM") {
    if (!input.servingAt) {
      throw new CartRuleError("Waktu penyajian khusus wajib diisi.");
    }
    servingAtDate =
      input.servingAt instanceof Date
        ? input.servingAt
        : new Date(input.servingAt);

    if (
      isNaN(servingAtDate.getTime()) ||
      servingAtDate.getTime() < startAt.getTime() ||
      servingAtDate.getTime() >= endAt.getTime()
    ) {
      throw new CartRuleError(
        "Waktu penyajian harus berada di dalam rentang jam reservasi."
      );
    }
  }

  // 3. Validasi Ruangan & Kapasitas (R-A1, R-A2)
  const room = await db.room.findUnique({ where: { id: input.roomId } });
  if (!room || room.isArchived) {
    throw new RoomUnavailableError("Ruangan tidak ditemukan atau sudah tidak aktif.");
  }

  if (input.guestCount < room.minGuests) {
    throw new RoomUnavailableError(
      `Jumlah tamu kurang dari kapasitas minimal ruangan (${room.minGuests} orang).`
    );
  }
  if (input.guestCount > room.maxGuests) {
    throw new RoomUnavailableError(
      `Jumlah tamu melebihi kapasitas maksimal ruangan (${room.maxGuests} orang).`
    );
  }

  // 4. Validasi Menu & Keranjang (R-C1 - R-C4, R-P1 - R-P3)
  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: { category: true },
  });

  const productsMap = new Map<string, ProductWithCategory>();
  for (const p of products) {
    productsMap.set(p.id, {
      id: p.id,
      name: p.name,
      basePrice: p.basePrice,
      options: p.options,
      isAvailable: p.isAvailable,
      isArchived: p.isArchived,
      category: {
        kind: p.category.kind,
        isActive: p.category.isActive,
      },
    });
  }

  const cart = validateCart(input.items, productsMap, setting ?? {});
  if (!cart.ok) {
    throw new CartRuleError(cart.error);
  }

  const holdMinutes = setting?.holdMinutes ?? 17;
  const holdExpiresAt = new Date(now.getTime() + holdMinutes * 60 * 1000);

  // 5. Transaksi Database dengan Row Lock dan Lazy Expiry
  let createdReservation: Reservation;

  try {
    createdReservation = await db.$transaction(async (tx) => {
      // Row lock ruangan: SELECT … FROM "Room" WHERE id=$1 FOR UPDATE
      await tx.$queryRawUnsafe(`SELECT 1 FROM "Room" WHERE id = $1 FOR UPDATE`, input.roomId);

      // Lazy expiry: PENDING_PAYMENT yang sudah lewat batas hold diubah jadi EXPIRED
      await tx.reservation.updateMany({
        where: {
          roomId: input.roomId,
          status: "PENDING_PAYMENT",
          holdExpiresAt: { lte: now },
        },
        data: { status: "EXPIRED" },
      });

      // Cek blokir ruangan (R-A4)
      const blocks = await tx.roomBlock.findMany({
        where: {
          roomId: input.roomId,
          startAt: { lt: endAt },
          OR: [{ endAt: null }, { endAt: { gt: startAt } }],
        },
      });

      if (blocks.length > 0) {
        throw new RoomUnavailableError(
          "Ruangan sedang tidak dapat dipesan pada jam tersebut karena pemeliharaan / blokir jadwal."
        );
      }

      // Generate unique code & ticketToken
      let code = generateCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const existingCode = await tx.reservation.findUnique({ where: { code } });
        if (!existingCode) break;
        code = generateCode();
      }

      const ticketToken = generateTicketToken();

      const reservation = await tx.reservation.create({
        data: {
          code,
          ticketToken,
          roomId: input.roomId,
          startAt,
          endAt,
          blockEndAt,
          guestCount: input.guestCount,
          customerName,
          customerPhone,
          customerEmail,
          servingTime: input.servingTime as ServingTime,
          servingAt: servingAtDate,
          kitchenNote,
          status: "PENDING_PAYMENT",
          totalAmount: cart.totalAmount,
          baseTotal: cart.baseTotal,
          holdExpiresAt,
          items: {
            create: cart.items.map((i) => ({
              productId: i.productId,
              productName: i.productName,
              option: i.option,
              kind: i.kind,
              unitPrice: i.unitPrice,
              basePrice: i.basePrice,
              quantity: i.quantity,
              lineTotal: i.lineTotal,
            })),
          },
        },
      });

      await tx.activityLog.create({
        data: {
          reservationId: reservation.id,
          action: "RESERVATION_CREATED",
          detail: {
            code: reservation.code,
            totalAmount: reservation.totalAmount,
            guestCount: reservation.guestCount,
          },
        },
      });

      return reservation;
    });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const msg = err instanceof Error ? err.message : "";
    // Tangkap exclusion constraint violation (Postgres error 23P01)
    if (msg.includes("23P01") || msg.includes("reservation_no_overlap")) {
      throw new SlotTakenError();
    }
    throw err;
  }

  // 6. Di luar transaksi: Payment Gateway Snap Creation
  try {
    const paymentItems = cart.items.map((item) => {
      const itemFullName = item.option
        ? `${item.productName} (${item.option})`
        : item.productName;
      return {
        id: item.productId,
        name: itemFullName.slice(0, 50),
        price: item.unitPrice,
        quantity: item.quantity,
      };
    });

    const paymentMethods = enabledPayments(cart.totalAmount, setting ?? {});
    const payment = await gateway.createPayment({
      orderId: createdReservation.code,
      amount: cart.totalAmount,
      items: paymentItems,
      customer: {
        name: customerName,
        phone: customerPhone,
        email: customerEmail || undefined,
      },
      enabledPayments: paymentMethods,
      expiryMinutes: setting?.paymentExpiryMinutes ?? 15,
    });

    await db.reservation.update({
      where: { id: createdReservation.id },
      data: {
        snapToken: payment.token,
        snapRedirectUrl: payment.redirectUrl,
      },
    });

    return {
      code: createdReservation.code,
      ticketToken: createdReservation.ticketToken,
      totalAmount: createdReservation.totalAmount,
      holdExpiresAt,
      snapToken: payment.token,
      snapRedirectUrl: payment.redirectUrl,
    };
  } catch (gwError: unknown) {
    // Kalau payment gateway gagal: ubah status jadi EXPIRED, slot dilepas, catat log, lempar 502
    await db.reservation.update({
      where: { id: createdReservation.id },
      data: { status: "EXPIRED" },
    });

    const errorMsg = gwError instanceof Error ? gwError.message : "Unknown payment error";
    await db.activityLog.create({
      data: {
        reservationId: createdReservation.id,
        action: "PAYMENT_GATEWAY_ERROR",
        detail: { error: errorMsg },
      },
    });

    throw new PaymentGatewayError("Gagal menghubungi layanan pembayaran. Silakan coba kembali.");
  }
}
