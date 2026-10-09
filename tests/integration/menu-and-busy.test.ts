import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { seed } from "../../prisma/seed";
import { getPublicMenu } from "@/server/menu";
import { getDayBusy } from "@/server/availability";
import { wibDateTime } from "@/server/time";

describe("Menu and Day Busy Integration Tests", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.reservationItem.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.roomBlock.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.room.deleteMany();
    await seed(prisma);
  });

  it("getPublicMenu returns categories and active available products with online prices", async () => {
    const menu = await getPublicMenu(prisma);
    expect(menu.categories.length).toBeGreaterThanOrEqual(4);
    const makanan = menu.categories.find((c) => c.name === "Makanan");
    expect(makanan).toBeDefined();
    expect(makanan?.products.length).toBeGreaterThan(0);
    const item = makanan?.products[0];
    expect(item?.price).toBeGreaterThan(0);
  });

  it("getDayBusy returns busy blocks including reservations and room blocks", async () => {
    const room = await prisma.room.findFirst({ where: { slug: "the-loft" } });
    const roomId = room!.id;

    const startAt = wibDateTime("2026-10-18", "10:00");
    const endAt = wibDateTime("2026-10-18", "12:00");
    const blockEndAt = wibDateTime("2026-10-18", "12:30");

    await prisma.reservation.create({
      data: {
        code: "ATM-BUSY01",
        ticketToken: "tok-busy-01-abcdefghijklmnop",
        roomId,
        startAt,
        endAt,
        blockEndAt,
        guestCount: 4,
        customerName: "Rudi",
        customerPhone: "6281234567890",
        servingTime: "ON_ARRIVAL",
        status: "CONFIRMED",
        totalAmount: 50000,
        baseTotal: 48000,
        holdExpiresAt: new Date(),
      },
    });

    const busyRes = await getDayBusy(roomId, "2026-10-18", wibDateTime("2026-10-16", "10:00"), prisma);
    expect(busyRes.busy).toHaveLength(1);
    expect(busyRes.busy[0].startAt.getTime()).toBe(startAt.getTime());
    expect(busyRes.busy[0].endAt.getTime()).toBe(blockEndAt.getTime());
  });
});
