import { todayWib, wibDateTime } from "@/server/time";
// Tanggal pemesanan selalu di masa depan supaya tes tidak kedaluwarsa (R-T4/R-T5)
const BOOK_DATE = todayWib(new Date(wibDateTime(todayWib(new Date()), "12:00").getTime() + 3 * 86400000));
import { setTestQris } from "../helpers/qris";
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { seed } from "../../prisma/seed";
import { GET as getMenu } from "@/app/api/menu/route";
import { GET as getAvailabilityRoute } from "@/app/api/availability/route";
import { GET as getDayBusyRoute } from "@/app/api/availability/day/route";
import { POST as createReservationRoute } from "@/app/api/reservations/route";
import { GET as getTicketRoute } from "@/app/api/tickets/[token]/route";
import { POST as lookupTicketRoute } from "@/app/api/tickets/lookup/route";
import { POST as claimPaymentRoute } from "@/app/api/tickets/[token]/claim-payment/route";
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
    await prisma.setting.deleteMany();

    await seed(prisma);
    await setTestQris(prisma);

    const room = await prisma.room.findFirst({ where: { slug: "ruangan-1" } });
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
    expect(makanan.products[0].price).toBe(27000); // markup 0% (K-36)
  });

  it("GET /api/availability returns room status and enforces rules", async () => {
    // Valid query for date far in future within 30 days
    const req = new NextRequest(
      `http://localhost:3000/api/availability?date=${BOOK_DATE}&start=10:00&end=12:00&guests=4`
    );
    const res = await getAvailabilityRoute(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.rooms.length).toBe(4);
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
      `http://localhost:3000/api/availability/day?roomId=${roomId}&date=${BOOK_DATE}`
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
        date: `${BOOK_DATE}`,
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
    const { code, ticketToken, payAmount, totalAmount } = createJson.data;
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    expect(ticketToken).toBeDefined();
    expect(payAmount).toBe(totalAmount + 100); // K-41
    expect(totalAmount).toBe(84000);

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
    expect(ticketJson.data.payAmount).toBe(payAmount);
    expect(ticketJson.data.qris).toMatch(/^000201010212/);
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

    // 3b. Kode yang diketik huruf kecil tetap ketemu
    const lowerRes = await lookupTicketRoute(
      new NextRequest("http://localhost:3000/api/tickets/lookup", {
        method: "POST",
        body: JSON.stringify({ code: code.toLowerCase(), phone: "0812-3456-7890" }),
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.50" },
      })
    );
    expect(lowerRes.status).toBe(200);
    expect((await lowerRes.json()).data.ticketToken).toBe(ticketToken);

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
        date: `${BOOK_DATE}`,
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

  it("POST /api/tickets/lookup: percobaan ke-11 dari IP yang sama → 429, IP lain tidak ikut terblokir", async () => {
    const lookup = (ip: string, code: string) =>
      lookupTicketRoute(
        new NextRequest("http://localhost:3000/api/tickets/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
          body: JSON.stringify({ code, phone: "081234567890" }),
        })
      );

    for (let i = 0; i < 10; i++) {
      expect((await lookup("10.0.0.9", "ZZZ9")).status).toBe(404);
    }
    const blocked = await lookup("10.0.0.9", "ZZZ9");
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error.code).toBe("RATE_LIMITED");

    expect((await lookup("10.0.0.10", "ZZZ9")).status).toBe(404);
  });

  it("POST /api/reservations with invalid WA number returns 400, not 500", async () => {
    const req = new NextRequest("http://localhost:3000/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        roomId,
        date: `${BOOK_DATE}`,
        start: "10:00",
        end: "12:00",
        guestCount: 4,
        items: [{ productId: foodId, option: null, quantity: 2 }],
        servingTime: "ON_ARRIVAL",
        customer: { name: "Budi Santoso", phone: "12345" },
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await createReservationRoute(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/tickets/[token]/claim-payment menandai klaim tanpa melunasi (R-Q4)", async () => {
    // 1. Create a reservation first
    const createReq = new NextRequest("http://localhost:3000/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        roomId,
        date: `${BOOK_DATE}`,
        start: "14:00",
        end: "16:00",
        guestCount: 4,
        items: [
          { productId: foodId, option: null, quantity: 2 },
          { productId: drinkId, option: "Ice", quantity: 2 },
        ],
        servingTime: "ON_ARRIVAL",
        customer: { name: "Budi Santoso", phone: "081234567890" },
      }),
      headers: { "Content-Type": "application/json" },
    });
    const createRes = await createReservationRoute(createReq);
    const { code, ticketToken } = (await createRes.json()).data;

    // 2. Customer klaim sudah bayar (R-Q4): hold diperpanjang, belum lunas sampai admin cek
    const claimRes = await claimPaymentRoute(
      new NextRequest(`http://localhost:3000/api/tickets/${ticketToken}/claim-payment`, { method: "POST" }),
      { params: Promise.resolve({ token: ticketToken }) }
    );
    expect(claimRes.status).toBe(200);
    const updated = await prisma.reservation.findUnique({ where: { code } });
    expect(updated?.paymentClaimedAt).not.toBeNull();
    expect(updated?.status).toBe("PENDING_PAYMENT");
  });
});
