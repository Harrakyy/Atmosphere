import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { seed } from "../../prisma/seed";
import { GET as getMenu } from "@/app/api/menu/route";
import { GET as getAvailabilityRoute } from "@/app/api/availability/route";
import { GET as getDayBusyRoute } from "@/app/api/availability/day/route";
import { POST as createReservationRoute } from "@/app/api/reservations/route";
import { GET as getTicketRoute } from "@/app/api/tickets/[token]/route";
import { POST as lookupTicketRoute } from "@/app/api/tickets/lookup/route";
import { NextRequest } from "next/server";

describe("End-to-End API Routes (Hari 1)", () => {
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

    await seed(prisma);

    const room = await prisma.room.findFirst({ where: { slug: "the-loft" } });
    roomId = room!.id;

    const food = await prisma.product.findFirst({ where: { name: "Pasta Aglio Olio" } });
    foodId = food!.id;

    const drink = await prisma.product.findFirst({ where: { name: "Jeruk" } });
    drinkId = drink!.id;
  });

  it("GET /api/menu returns categories and products with online prices", async () => {
    const res = await getMenu();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.categories.length).toBeGreaterThanOrEqual(4);
    const makanan = json.data.categories.find(
      (c: { name: string; products: { price: number }[] }) => c.name === "Makanan"
    );
    expect(makanan.products.length).toBeGreaterThan(0);
    expect(makanan.products[0].price).toBe(28000); // 27000 -> 28000
  });

  it("GET /api/availability returns room status and enforces rules", async () => {
    // Valid query for date far in future within 30 days
    const req = new NextRequest(
      "http://localhost:3000/api/availability?date=2026-10-18&start=10:00&end=12:00&guests=4"
    );
    const res = await getAvailabilityRoute(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.rooms.length).toBe(3);
    const loft = json.data.rooms.find(
      (r: { id: string; available: boolean }) => r.id === roomId
    );
    expect(loft.available).toBe(true);

    // Invalid: past date
    const pastReq = new NextRequest(
      "http://localhost:3000/api/availability?date=2020-01-01&start=10:00&end=12:00&guests=4"
    );
    const pastRes = await getAvailabilityRoute(pastReq);
    expect(pastRes.status).toBe(422);
    const pastJson = await pastRes.json();
    expect(pastJson.success).toBe(false);
    expect(pastJson.error.code).toBe("TIME_RULE");
  });

  it("GET /api/availability/day returns busy blocks", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/availability/day?roomId=${roomId}&date=2026-10-18`
    );
    const res = await getDayBusyRoute(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.busy)).toBe(true);
  });

  it("Full booking flow: POST /api/reservations -> GET /api/tickets/[token] -> POST /api/tickets/lookup", async () => {
    // 1. Create reservation
    const createReq = new NextRequest("http://localhost:3000/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        roomId,
        date: "2026-10-18",
        start: "10:00",
        end: "12:00",
        guestCount: 4,
        items: [
          { productId: foodId, option: null, quantity: 2 },
          { productId: drinkId, option: "Ice", quantity: 2 },
        ],
        servingTime: "ON_ARRIVAL",
        customer: {
          name: "Budi Santoso",
          phone: "081234567890",
          email: "budi@example.com",
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const createRes = await createReservationRoute(createReq);
    expect(createRes.status).toBe(201);
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);
    const { code, ticketToken, snapToken, totalAmount } = createJson.data;
    expect(code).toMatch(/^ATM-/);
    expect(ticketToken).toBeDefined();
    expect(snapToken).toContain("fake_snap_token_");
    expect(totalAmount).toBe(87000);

    // 2. Retrieve ticket by token
    const ticketRes = await getTicketRoute(
      new NextRequest(`http://localhost:3000/api/tickets/${ticketToken}`),
      { params: Promise.resolve({ token: ticketToken }) }
    );
    expect(ticketRes.status).toBe(200);
    const ticketJson = await ticketRes.json();
    expect(ticketJson.success).toBe(true);
    expect(ticketJson.data.code).toBe(code);
    expect(ticketJson.data.status).toBe("PENDING_PAYMENT");
    expect(ticketJson.data.snapToken).toBe(snapToken);
    expect(ticketJson.data.wa.saveLink).toContain("wa.me");

    // 3. Lookup ticket by code & phone
    const lookupReq = new NextRequest("http://localhost:3000/api/tickets/lookup", {
      method: "POST",
      body: JSON.stringify({
        code,
        phone: "0812-3456-7890",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const lookupRes = await lookupTicketRoute(lookupReq);
    expect(lookupRes.status).toBe(200);
    const lookupJson = await lookupRes.json();
    expect(lookupJson.success).toBe(true);
    expect(lookupJson.data.ticketToken).toBe(ticketToken);

    // 4. Invalid lookup returns 404
    const badLookupReq = new NextRequest("http://localhost:3000/api/tickets/lookup", {
      method: "POST",
      body: JSON.stringify({
        code,
        phone: "089999999999",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const badLookupRes = await lookupTicketRoute(badLookupReq);
    expect(badLookupRes.status).toBe(404);
  });

  it("POST /api/reservations rejects invalid cart (missing drink)", async () => {
    const req = new NextRequest("http://localhost:3000/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        roomId,
        date: "2026-10-18",
        start: "10:00",
        end: "12:00",
        guestCount: 4,
        items: [{ productId: foodId, option: null, quantity: 2 }],
        servingTime: "ON_ARRIVAL",
        customer: {
          name: "Budi Santoso",
          phone: "081234567890",
        },
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await createReservationRoute(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("CART_RULE");
  });
});
