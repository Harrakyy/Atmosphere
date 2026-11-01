import { setTestQris } from "../helpers/qris";
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { seed } from "../../prisma/seed";
import { createReservation } from "@/server/reservations/create";
import { claimPayment, markPaid, rejectPayment } from "@/server/reservations/transitions";
import { getNeedsActionReservations, getTicketByToken } from "@/server/reservations/queries";
import { InvalidTransitionError } from "@/server/http";
import { wibDateTime } from "@/server/time";

const NOW = wibDateTime("2026-10-16", "12:00");
const MIN = 60 * 1000;

describe("Pembayaran QRIS manual (R-Q2..R-Q6)", () => {
  let roomId: string;
  let items: { productId: string; option: string | null; quantity: number }[];

  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.reservationItem.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.roomBlock.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.room.deleteMany();
    await prisma.setting.deleteMany();
    await seed(prisma);
    await setTestQris(prisma);
    roomId = (await prisma.room.findFirstOrThrow({ where: { slug: "ruangan-1" } })).id;
    const food = await prisma.product.findFirstOrThrow({ where: { name: "Pasta Aglio Olio" } });
    const drink = await prisma.product.findFirstOrThrow({ where: { name: "Jeruk" } });
    items = [
      { productId: food.id, option: null, quantity: 2 },
      { productId: drink.id, option: "Ice", quantity: 2 },
    ];
  });

  const book = (start = "10:00", end = "12:00", now = NOW) =>
    createReservation(
      {
        roomId, date: "2026-10-18", start, end, guestCount: 5, items,
        servingTime: "ON_ARRIVAL",
        customer: { name: "Budi Santoso", phone: "081234567890" },
      },
      { now, db: prisma }
    );

  it("tiket menampilkan QRIS dinamis dengan nominal payAmount selama menunggu bayar", async () => {
    const r = await book();
    const ticket = await getTicketByToken(r.ticketToken, NOW, "http://x", prisma);
    expect(ticket.payAmount).toBe(r.totalAmount + 100); // K-41
    expect(ticket.qris).toContain(`54${String(ticket.payAmount).length.toString().padStart(2, "0")}${ticket.payAmount}`);
    expect(ticket.qris).toMatch(/^000201010212/);
  });

  it("klaim bayar memperpanjang hold sekali dan masuk Perlu Tindakan; Tandai Lunas → CONFIRMED", async () => {
    const r = await book();
    const claimed = await claimPayment(r.ticketToken, new Date(NOW.getTime() + 5 * MIN), prisma);
    expect(claimed.holdExpiresAt.getTime()).toBe(NOW.getTime() + 125 * MIN);

    // klaim kedua tidak memperpanjang lagi
    const again = await claimPayment(r.ticketToken, new Date(NOW.getTime() + 60 * MIN), prisma);
    expect(again.holdExpiresAt.getTime()).toBe(claimed.holdExpiresAt.getTime());

    const needs = await getNeedsActionReservations(new Date(NOW.getTime() + 10 * MIN), prisma);
    expect(needs.map((n) => n.id)).toContain(claimed.id);

    const paid = await markPaid(claimed.id, null, new Date(NOW.getTime() + 30 * MIN), prisma);
    expect(paid.status).toBe("CONFIRMED");
    expect(paid.paymentType).toBe("QRIS");
  });

  it("klaim ditolak untuk tiket yang hold-nya sudah habis", async () => {
    const r = await book();
    await expect(claimPayment(r.ticketToken, new Date(NOW.getTime() + 60 * MIN), prisma)).rejects.toThrow(
      InvalidTransitionError
    );
  });

  it("Tolak → EXPIRED, klaim dihapus, keluar dari Perlu Tindakan", async () => {
    const r = await book();
    const claimed = await claimPayment(r.ticketToken, NOW, prisma);
    const rejected = await rejectPayment(claimed.id, "admin", prisma);
    expect(rejected.status).toBe("EXPIRED");
    expect(rejected.paymentClaimedAt).toBeNull();
    const needs = await getNeedsActionReservations(NOW, prisma);
    expect(needs.map((n) => n.id)).not.toContain(claimed.id);
  });

  it("bayar terlambat saat slot sudah diambil → CANCELLED (SYSTEM) dengan refund = payAmount", async () => {
    const late = await book();
    const later = new Date(NOW.getTime() + 30 * MIN); // hold 17 menit sudah habis
    const other = await book("10:00", "12:00", later); // lazy expiry melepas slot
    expect(other.payAmount).not.toBe(late.payAmount); // nominal expired ≤24 jam tidak dipakai ulang (R-Q3)

    const lateRow = await prisma.reservation.findUniqueOrThrow({ where: { code: late.code } });
    const result = await markPaid(lateRow.id, null, later, prisma);
    expect(result.status).toBe("CANCELLED");
    expect(result.cancelledBy).toBe("SYSTEM");
    expect(result.refundAmount).toBe(late.payAmount);
  });

  it("dua checkout paralel di ruangan berbeda dengan total sama → nominal unik berbeda (retry unique index)", async () => {
    const room2 = (await prisma.room.findFirstOrThrow({ where: { slug: "ruangan-2" } })).id;
    const input = (rid: string) => ({
      roomId: rid, date: "2026-10-18", start: "10:00", end: "12:00", guestCount: 4, items,
      servingTime: "ON_ARRIVAL" as const,
      customer: { name: "Budi Santoso", phone: "081234567890" },
    });
    const [a, b] = await Promise.all([
      createReservation(input(roomId), { now: NOW, db: prisma }),
      createReservation(input(room2), { now: NOW, db: prisma }),
    ]);
    expect(new Set([a.payAmount, b.payAmount]).size).toBe(2);
  });
});
