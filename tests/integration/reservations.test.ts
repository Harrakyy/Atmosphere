import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { seed } from "../../prisma/seed";
import { createReservation } from "@/server/reservations/create";
import { getAvailability } from "@/server/availability";
import { getTicketByToken, lookupTicket } from "@/server/reservations/queries";
import { FakeGateway } from "@/server/payments/fake";
import {
  SlotTakenError,
  TimeRuleError,
  RoomUnavailableError,
  PaymentGatewayError,
} from "@/server/http";
import { wibDateTime } from "@/server/time";

describe("Reservations Integration Tests (Day 1)", () => {
  let fakeGateway: FakeGateway;
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

    await seed(prisma);

    fakeGateway = new FakeGateway();

    const room = await prisma.room.findFirst({ where: { slug: "the-loft" } });
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
      { gateway: fakeGateway, now: fixedNow, db: prisma }
    );

    expect(result.code).toMatch(/^ATM-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect(result.ticketToken).toHaveLength(32);
    expect(result.snapToken).toBe(`fake_snap_token_${result.code}`);

    // Verify database record
    const saved = await prisma.reservation.findUnique({
      where: { code: result.code },
      include: { items: true },
    });

    expect(saved).toBeDefined();
    expect(saved?.status).toBe("PENDING_PAYMENT");
    expect(saved?.customerPhone).toBe("6281234567890");
    expect(saved?.items).toHaveLength(2);

    // Verify snapshot: 2 * 28000 + 2 * 15500 = 56000 + 31000 = 87000
    expect(saved?.totalAmount).toBe(87000);
    expect(result.totalAmount).toBe(87000);

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
      createReservation(payloadA, { gateway: fakeGateway, now: fixedNow, db: prisma }),
      createReservation(payloadB, { gateway: fakeGateway, now: fixedNow, db: prisma }),
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
      { gateway: fakeGateway, now: fixedNow, db: prisma }
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
        { gateway: fakeGateway, now: fixedNow, db: prisma }
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
      { gateway: fakeGateway, now: fixedNow, db: prisma }
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
      { gateway: fakeGateway, now: pastNow, db: prisma }
    );

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
      { gateway: fakeGateway, now: laterNow, db: prisma }
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
        { gateway: fakeGateway, now: fixedNow, db: prisma }
      )
    ).rejects.toThrow(RoomUnavailableError);
  });

  it("6. FakeGateway fails: reservation marked EXPIRED, 502 thrown, slot immediately freed", async () => {
    const fixedNow = wibDateTime("2026-10-16", "12:00");
    fakeGateway.setShouldFail(true);

    await expect(
      createReservation(
        {
          ...baseInput,
          roomId: testRoomId,
          items: getValidItems(),
        },
        { gateway: fakeGateway, now: fixedNow, db: prisma }
      )
    ).rejects.toThrow(PaymentGatewayError);

    // Slot can immediately be reserved again
    const nextBooking = await createReservation(
      {
        ...baseInput,
        roomId: testRoomId,
        items: getValidItems(),
      },
      { gateway: fakeGateway, now: fixedNow, db: prisma }
    );
    expect(nextBooking.code).toBeDefined();
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
        { gateway: fakeGateway, now: sameDayNow, db: prisma }
      )
    ).rejects.toThrow(TimeRuleError);
  });

  it("8. Guest count outside min/max guests: available=false with correct reasons", async () => {
    const fixedNow = wibDateTime("2026-10-16", "10:00");

    // The Loft capacity is 4 - 10
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
        { gateway: fakeGateway, now: fixedNow, db: prisma }
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
      { gateway: fakeGateway, now: fixedNow, db: prisma }
    );

    const saved = await prisma.reservation.findUnique({ where: { code: result.code } });
    expect(saved?.servingTime).toBe("CUSTOM");
    expect(saved?.servingAt).toBeDefined();
    expect(saved?.servingAt?.toISOString()).toBe(wibDateTime("2026-10-18", "11:30").toISOString());
  });
});
