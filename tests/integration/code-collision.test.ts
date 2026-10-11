import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/server/db";
import { seed } from "../../prisma/seed";
import { createReservation } from "@/server/reservations/create";
import { FakeGateway } from "@/server/payments/fake";

// Generator dipaksa selalu menghasilkan kode yang sama, untuk menguji jalur kehabisan percobaan
vi.mock("@/server/codes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/codes")>()),
  generateCode: () => "7K2F",
}));

describe("Tabrakan kode booking 4 karakter", () => {
  let roomId: string;
  let foodId: string;
  let drinkId: string;

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

    roomId = (await prisma.room.findFirst({ where: { slug: "ruangan-1" } }))!.id;
    foodId = (await prisma.product.findFirst({ where: { name: "Pasta Aglio Olio" } }))!.id;
    drinkId = (await prisma.product.findFirst({ where: { name: "Jeruk" } }))!.id;
  });

  const book = (start: string, end: string) =>
    createReservation(
      {
        roomId,
        date: "2026-10-18",
        start,
        end,
        guestCount: 5,
        items: [
          { productId: foodId, option: null, quantity: 1 },
          { productId: drinkId, option: "Ice", quantity: 1 },
        ],
        servingTime: "ON_ARRIVAL",
        customer: { name: "Budi Santoso", phone: "0812-3456-7890" },
      },
      { gateway: new FakeGateway(), now: new Date("2026-10-10T10:00:00+07:00"), db: prisma }
    );

  it("kalau semua percobaan kode bentrok → AppError CODE_COLLISION yang jelas, bukan error database mentah", async () => {
    await book("10:00", "12:00");

    await expect(book("15:00", "17:00")).rejects.toMatchObject({
      code: "CODE_COLLISION",
      statusCode: 503,
    });
    expect(await prisma.reservation.count()).toBe(1);
  });
});
