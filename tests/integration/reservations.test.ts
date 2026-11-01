import { setTestQris } from "../helpers/qris";
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { seed } from "../../prisma/seed";
import { createReservation } from "@/server/reservations/create";
import { getAvailability } from "@/server/availability";
import { getTicketByToken, lookupTicket } from "@/server/reservations/queries";
import {
  SlotTakenError,
  TimeRuleError,
  RoomUnavailableError,
} from "@/server/http";
import { wibDateTime } from "@/server/time";

describe("Reservations Integration Tests (Day 1)", () => {
  let testRoomId: string;
  let foodProductId: string;
  let drinkProductId: string;

  beforeEach(async () => {
    // Reset test database
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

    const room = await prisma.room.findFirst({ where: { slug: "ruangan-1" } });
    testRoomId = room!.id;

    const food = await prisma.product.findFirst({ where: { name: "Pasta Aglio Olio" } });
    foodProductId = food!.id;

    const drink = await prisma.product.findFirst({ where: { name: "Jeruk" } });
    drinkProductId = drink!.id;
  });

  const baseInput = {
    date: "2026-10-18",
    start: "10:00",
    end: "12:00",
    guestCount: 5,
    servingTime: "ON_ARRIVAL" as const,
    customer: {
      name: "Budi Santoso",
      phone: "0812-3456-7890",
      email: "budi@example.com",
    },
  };

  const getValidItems = () => [
    { productId: foodProductId, option: null, quantity: 2 },
    { productId: drinkProductId, option: "Ice", quantity: 2 },
  ];

  it("1. Checkout succeeds: PENDING_PAYMENT, items snapshot saved, total correct", async () => {
    const fixedNow = wibDateTime("2026-10-16", "12:00");
    const result = await createReservation(
      {
        ...baseInput,
        roomId: testRoomId,
        items: getValidItems(),
      },
      { now: fixedNow, db: prisma }
    );

    expect(result.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    expect(result.ticketToken).toHaveLength(32);
    // R-Q3: nominal unik pertama = total − Rp1
    expect(result.uniqueCode).toBe(100); // K-41: Rp84.000 → Rp84.100
    expect(result.payAmount).toBe(result.totalAmount + 100);

    // Verify database record
    const saved = await prisma.reservation.findUnique({
      where: { code: result.code },
      include: { items: true },
    });

    expect(saved).toBeDefined();
    expect(saved?.status).toBe("PENDING_PAYMENT");
    expect(saved?.customerPhone).toBe("6281234567890");
    expect(saved?.items).toHaveLength(2);

    // Verify snapshot (markup 0%, K-36): 2 * 27000 + 2 * 15000 = 84000
    expect(saved?.totalAmount).toBe(84000);
    expect(result.totalAmount).toBe(84000);

    // Verify ticket query
    const ticket = await getTicketByToken(result.ticketToken, fixedNow);
    expect(ticket.code).toBe(result.code);
    expect(ticket.status).toBe("PENDING_PAYMENT");
    expect(ticket.wa.saveLink).toContain("wa.me");

    // Verify lookup ticket
    const lookup = await lookupTicket({ code: result.code, phone: "081234567890" });
    expect(lookup.ticketToken).toBe(result.ticketToken);
  });

  it("2. Parallel checkouts for the same slot: exactly one succeeds, one gets SlotTakenError (409)", async () => {
    const fixedNow = wibDateTime("2026-10-16", "12:00");

    const payloadA = {
      ...baseInput,
      roomId: testRoomId,
      items: getValidItems(),
      customer: { name: "User A", phone: "08121111111" },
    };

    const payloadB = {
      ...baseInput,
      roomId: testRoomId,
      items: getValidItems(),
      customer: { name: "User B", phone: "08122222222" },
    };

    const results = await Promise.allSettled([
      createReservation(payloadA, { now: fixedNow, db: prisma }),
      createReservation(payloadB, { now: fixedNow, db: prisma }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(SlotTakenError);
  });

  it("3. Buffer: booking 10–12 rejects 12:00, but accepts 12:30", async () => {
    const fixedNow = wibDateTime("2026-10-16", "12:00");

    // First booking 10:00 - 12:00
    await createReservation(
      {
        ...baseInput,
        roomId: testRoomId,
        items: getValidItems(),
      },
      { now: fixedNow, db: prisma }
    );

    // Booking starting at 12:00 (within 30-min buffer) must be rejected
    await expect(
      createReservation(
        {
          ...baseInput,
          roomId: testRoomId,
          start: "12:00",
          end: "13:30",
          items: getValidItems(),
        },
        { now: fixedNow, db: prisma }
      )
    ).rejects.toThrow(SlotTakenError);

    // Booking starting at 12:30 (after buffer) must succeed
    const okBooking = await createReservation(
      {
        ...baseInput,
        roomId: testRoomId,
        start: "12:30",
        end: "14:00",
        items: getValidItems(),
      },
      { now: fixedNow, db: prisma }
    );
    expect(okBooking.code).toBeDefined();
  });

  it("4. Hold time expiry: slot can be booked again (lazy expiry)", async () => {
    const pastNow = wibDateTime("2026-10-16", "10:00");
    // Create reservation with holdExpiresAt = pastNow + 17 mins = 10:17
    const oldRes = await createReservation(
      {
        ...baseInput,
        roomId: testRoomId,
        items: getValidItems(),
      },
      { now: pastNow, db: prisma }
    );

    // Before hold expires (e.g. at 10:05), room availability returns BOOKED
    const activeAvail = await getAvailability(
      { date: "2026-10-18", start: "10:00", end: "12:00", guests: 5 },
      wibDateTime("2026-10-16", "10:05"),
      prisma
    );
    const loftBooked = activeAvail.rooms.find((r) => r.id === testRoomId);
    expect(loftBooked?.available).toBe(false);
    expect(loftBooked?.reason).toBe("BOOKED");

    // Later at 10:30 (hold time has expired)
    const laterNow = wibDateTime("2026-10-16", "10:30");

    // Check availability considers slot empty
    const avail = await getAvailability(
      { date: "2026-10-18", start: "10:00", end: "12:00", guests: 5 },
      laterNow,
      prisma
    );
    const loftRoom = avail.rooms.find((r) => r.id === testRoomId);
    expect(loftRoom?.available).toBe(true);

    // New booking for the same slot succeeds
    const newRes = await createReservation(
      {
        ...baseInput,
        roomId: testRoomId,
        items: getValidItems(),
        customer: { name: "Customer Baru", phone: "08198765432" },
      },
      { now: laterNow, db: prisma }
    );
    expect(newRes.code).not.toBe(oldRes.code);

    // Old reservation is now EXPIRED
    const oldSaved = await prisma.reservation.findUnique({ where: { code: oldRes.code } });
    expect(oldSaved?.status).toBe("EXPIRED");
  });

  it("5. Room block: room unavailable with reason BLOCKED", async () => {
    const fixedNow = wibDateTime("2026-10-16", "10:00");
    const blockStart = wibDateTime("2026-10-19", "00:00");
    const blockEnd = wibDateTime("2026-10-20", "00:00");

    await prisma.roomBlock.create({
      data: {
        roomId: testRoomId,
        startAt: blockStart,
        endAt: blockEnd,
        reason: "Renovasi AC",
        createdById: "admin-1",
      },
    });

    const avail = await getAvailability(
      { date: "2026-10-19", start: "10:00", end: "12:00", guests: 5 },
      fixedNow,
      prisma
    );
    const loft = avail.rooms.find((r) => r.id === testRoomId);
    expect(loft?.available).toBe(false);
    expect(loft?.reason).toBe("BLOCKED");

    await expect(
      createReservation(
        {
          ...baseInput,
          date: "2026-10-19",
          roomId: testRoomId,
          items: getValidItems(),
        },
        { now: fixedNow, db: prisma }
      )
    ).rejects.toThrow(RoomUnavailableError);
  });

  it("6. R-Q7 QRIS belum diatur → 503; R-Q3 nominal unik berbeda untuk total yang sama", async () => {
    const fixedNow = wibDateTime("2026-10-16", "12:00");
    await prisma.setting.update({ where: { id: 1 }, data: { qrisPayload: "" } });
    await expect(
      createReservation({ ...baseInput, roomId: testRoomId, items: getValidItems() }, { now: fixedNow, db: prisma })
    ).rejects.toMatchObject({ code: "PAYMENT_NOT_CONFIGURED", statusCode: 503 });

    await setTestQris(prisma);
    const first = await createReservation(
      { ...baseInput, roomId: testRoomId, items: getValidItems() },
      { now: fixedNow, db: prisma }
    );
    const second = await createReservation(
      { ...baseInput, roomId: testRoomId, start: "14:00", end: "16:00", items: getValidItems() },
      { now: fixedNow, db: prisma }
    );
    expect(first.totalAmount).toBe(second.totalAmount);
    expect([first.uniqueCode, second.uniqueCode]).toEqual([100, 101]);
  });

  it("7. Booking on H-0: rejected with 422 TIME_RULE", async () => {
    // Current time is 2026-10-18 10:00 WIB, trying to book for 2026-10-18
    const sameDayNow = wibDateTime("2026-10-18", "10:00");

    await expect(
      createReservation(
        {
          ...baseInput,
          date: "2026-10-18",
          roomId: testRoomId,
          items: getValidItems(),
        },
        { now: sameDayNow, db: prisma }
      )
    ).rejects.toThrow(TimeRuleError);
  });

  it("8. Guest count outside min/max guests: available=false with correct reasons", async () => {
    const fixedNow = wibDateTime("2026-10-16", "10:00");

    // Ruangan 1 capacity is 4 - 10
    // Query with 2 guests
    const lowAvail = await getAvailability(
      { date: "2026-10-18", start: "10:00", end: "12:00", guests: 2 },
      fixedNow,
      prisma
    );
    const loftLow = lowAvail.rooms.find((r) => r.id === testRoomId);
    expect(loftLow?.available).toBe(false);
    expect(loftLow?.reason).toBe("BELOW_MIN_GUESTS");

    // Query with 15 guests
    const highAvail = await getAvailability(
      { date: "2026-10-18", start: "10:00", end: "12:00", guests: 15 },
      fixedNow,
      prisma
    );
    const loftHigh = highAvail.rooms.find((r) => r.id === testRoomId);
    expect(loftHigh?.available).toBe(false);
    expect(loftHigh?.reason).toBe("CAPACITY_TOO_SMALL");

    // Attempt create reservation with 2 guests
    await expect(
      createReservation(
        {
          ...baseInput,
          guestCount: 2,
          roomId: testRoomId,
          items: getValidItems(),
        },
        { now: fixedNow, db: prisma }
      )
    ).rejects.toThrow(RoomUnavailableError);
  });

  it("9. Custom serving time passed as HH:mm string parses into correct WIB DateTime", async () => {
    const fixedNow = wibDateTime("2026-10-16", "10:00");
    const result = await createReservation(
      {
        ...baseInput,
        roomId: testRoomId,
        items: getValidItems(),
        servingTime: "CUSTOM",
        servingAt: "11:30",
      },
      { now: fixedNow, db: prisma }
    );

    const saved = await prisma.reservation.findUnique({ where: { code: result.code } });
    expect(saved?.servingTime).toBe("CUSTOM");
    expect(saved?.servingAt).toBeDefined();
    expect(saved?.servingAt?.toISOString()).toBe(wibDateTime("2026-10-18", "11:30").toISOString());
  });
});
