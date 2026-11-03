import { prisma } from "../db";
import { validateSchedule } from "../time-rules";
import { validateCart, CartItemInput, ProductWithCategory } from "../cart";
import { normalizePhone } from "../phone";
import { generateCode, generateTicketToken } from "../codes";
import { pickUniqueCode, type Band } from "../payment-band";
import {
  AppError,
  SlotTakenError,
  TimeRuleError,
  CartRuleError,
  RoomUnavailableError,
  PaymentNotConfiguredError,
  CodeCollisionError,
} from "../http";
import { wibDateTime } from "../time";
import { ServingTime, Prisma } from "@prisma/client";

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
  uniqueCode: number;
  payAmount: number;
  holdExpiresAt: Date;
}

export async function createReservation(
  input: CreateReservationInput,
  deps: {
    now?: Date;
    db?: typeof prisma;
  } = {}
): Promise<CreateReservationResult> {
  const db = deps.db ?? prisma;
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
    if (typeof input.servingAt === "string" && /^\d{2}:\d{2}$/.test(input.servingAt)) {
      servingAtDate = wibDateTime(input.date, input.servingAt);
    } else {
      servingAtDate =
        input.servingAt instanceof Date
          ? input.servingAt
          : new Date(input.servingAt);
    }

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

  // R-Q7: tanpa QRIS cafe, customer tidak punya cara membayar
  if (!setting?.qrisPayload) {
    throw new PaymentNotConfiguredError();
  }

  const holdMinutes = setting.holdMinutes;
  const holdExpiresAt = new Date(now.getTime() + holdMinutes * 60 * 1000);

  // Dua request bersamaan bisa memilih kode atau nominal unik yang sama; unique index menolak salah satunya, ulangi
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const reservation = await db.$transaction(async (tx) => {
        // Row lock ruangan: SELECT … FROM "Room" WHERE id=$1 FOR UPDATE
        await tx.$queryRawUnsafe(`SELECT 1 FROM "Room" WHERE id = $1 FOR UPDATE`, input.roomId);

        // Lazy expiry di semua ruangan: hold kedaluwarsa juga melepas nominal unik yang dipegangnya
        await tx.reservation.updateMany({
          where: { status: "PENDING_PAYMENT", holdExpiresAt: { lte: now } },
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

        // Generate unique code & ticketToken: semua percobaan dicek, tidak ada kode yang dipakai tanpa dicek
        let code = "";
        for (let i = 0; i < 5 && !code; i++) {
          const candidate = generateCode();
          if (!(await tx.reservation.findUnique({ where: { code: candidate } }))) code = candidate;
        }
        if (!code) throw new CodeCollisionError();

        const uniqueCode = await pickReservationCode(tx, cart.totalAmount, now, { min: setting.bandMin, max: setting.bandMax });

        const created = await tx.reservation.create({
          data: {
            code,
            createdAt: now, // sama dengan jam yang dipakai aturan lain (hold, anti-replay pembayaran)
            ticketToken: generateTicketToken(),
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
            uniqueCode,
            payAmount: cart.totalAmount + uniqueCode,
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
            reservationId: created.id,
            action: "RESERVATION_CREATED",
            detail: {
              code: created.code,
              totalAmount: created.totalAmount,
              payAmount: created.payAmount,
              guestCount: created.guestCount,
            },
          },
        });

        return created;
      });

      return {
        code: reservation.code,
        ticketToken: reservation.ticketToken,
        totalAmount: reservation.totalAmount,
        uniqueCode: reservation.uniqueCode,
        payAmount: reservation.payAmount,
        holdExpiresAt,
      };
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      const msg = err instanceof Error ? err.message : "";
      // Tangkap exclusion constraint violation (Postgres error 23P01)
      if (msg.includes("23P01") || msg.includes("reservation_no_overlap")) {
        throw new SlotTakenError();
      }
      throw err;
    }
  }
  throw new CodeCollisionError();
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// R-Q3 + K-41: nominal bayar = total + kode unik, di jalur Atmosphere (Protokol Setor) dan belum dipakai.
// Nominal yang menunggu bayar, kedaluwarsa ≤24 jam, atau baru lunas ≤24 jam ikut dihindari supaya
// bayar terlambat atau bayar dobel tidak tertukar dengan pesanan baru.
async function pickReservationCode(tx: Tx, totalAmount: number, now: Date, band: Band): Promise<number> {
  const recent = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const used = await tx.reservation.findMany({
    where: {
      payAmount: { gt: totalAmount, lt: totalAmount + 1000 },
      OR: [
        { status: "PENDING_PAYMENT" },
        { status: "EXPIRED", holdExpiresAt: { gte: recent } },
        { status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED"] }, paidAt: { gte: recent } },
      ],
    },
    select: { payAmount: true },
  });
  try {
    return pickUniqueCode(totalAmount, new Set(used.map((r) => r.payAmount)), band);
  } catch {
    throw new AppError(
      "PAYMENT_BUSY",
      "Terlalu banyak pembayaran yang sedang menunggu. Silakan coba lagi beberapa menit lagi.",
      503
    );
  }
}
