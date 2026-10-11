import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db";

describe("Database Constraints", () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.activityLog.deleteMany();
    await prisma.reservationItem.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.roomBlock.deleteMany();
    await prisma.room.deleteMany();
    await prisma.setting.deleteMany();
  });

  it("rejects overlapping confirmed reservations in the same room with 23P01", async () => {
    const room = await prisma.room.create({
      data: {
        name: "Test Room",
        slug: "test-room",
        minGuests: 2,
        maxGuests: 10,
      },
    });

    const startAt = new Date("2026-10-18T03:00:00Z"); // 10:00 WIB
    const endAt = new Date("2026-10-18T05:00:00Z"); // 12:00 WIB
    const blockEndAt = new Date("2026-10-18T05:30:00Z"); // 12:30 WIB (with buffer)
    const holdExpiresAt = new Date("2026-10-18T03:17:00Z");

    await prisma.reservation.create({
      data: {
        code: "ATM-TEST01",
        ticketToken: "token-test-01-abcdefghijklmnop",
        roomId: room.id,
        startAt,
        endAt,
        blockEndAt,
        guestCount: 4,
        customerName: "Budi",
        customerPhone: "6281234567890",
        servingTime: "ON_ARRIVAL",
        status: "CONFIRMED",
        totalAmount: 50000,
        baseTotal: 48000,
        holdExpiresAt,
      },
    });

    // Attempt overlapping reservation
    const overlapStartAt = new Date("2026-10-18T04:00:00Z"); // 11:00 WIB
    const overlapEndAt = new Date("2026-10-18T06:00:00Z"); // 13:00 WIB
    const overlapBlockEndAt = new Date("2026-10-18T06:30:00Z");

    let error: Error | null = null;
    try {
      await prisma.reservation.create({
        data: {
          code: "ATM-TEST02",
          ticketToken: "token-test-02-abcdefghijklmnop",
          roomId: room.id,
          startAt: overlapStartAt,
          endAt: overlapEndAt,
          blockEndAt: overlapBlockEndAt,
          guestCount: 4,
          customerName: "Ani",
          customerPhone: "6281234567891",
          servingTime: "ON_ARRIVAL",
          status: "CONFIRMED",
          totalAmount: 50000,
          baseTotal: 48000,
          holdExpiresAt,
        },
      });
    } catch (e) {
      if (e instanceof Error) error = e;
    }

    expect(error).toBeDefined();
    // PostgreSQL exclusion constraint code is 23P01
    expect(error!.message).toMatch(/23P01|reservation_no_overlap/);
  });
});
