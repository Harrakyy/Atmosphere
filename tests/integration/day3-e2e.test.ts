import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { seed } from "../../prisma/seed";
import { auth, seedAdminUser } from "@/server/auth";
import { GET as getAvailabilityRoute } from "@/app/api/availability/route";
import { GET as getMenuRoute } from "@/app/api/menu/route";
import { POST as createReservationRoute } from "@/app/api/reservations/route";
import { GET as getTicketRoute } from "@/app/api/tickets/[token]/route";
import { POST as lookupTicketRoute } from "@/app/api/tickets/lookup/route";
import { POST as notificationRoute } from "@/app/api/payments/midtrans/notification/route";
import { GET as getAdminCheckInSummaryRoute } from "@/app/api/admin/check-in/[code]/route";
import { POST as postAdminCheckInRoute } from "@/app/api/admin/reservations/[id]/check-in/route";
import { POST as postAdminCompleteRoute } from "@/app/api/admin/reservations/[id]/complete/route";
import { GET as getAdminKitchenRoute } from "@/app/api/admin/kitchen/route";
import { NextRequest } from "next/server";

describe("Hari 3 End-to-End Customer and Admin Flow", () => {
  let roomId: string;
  let foodId: string;
  let drinkId: string;
  let adminCookie: string;

  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.paymentNotification.deleteMany();
    await prisma.reservationItem.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.roomBlock.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.room.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();

    await seed(prisma);

    const room = await prisma.room.findFirst({ where: { slug: "the-loft" } });
    roomId = room!.id;

    const food = await prisma.product.findFirst({ where: { name: "Pasta Aglio Olio" } });
    foodId = food!.id;

    const drink = await prisma.product.findFirst({ where: { name: "Jeruk" } });
    drinkId = drink!.id;

    // Seed admin & get session cookie
    await seedAdminUser("admin@atmosphere.cafe", "adminpassword123", prisma);
    const signInResult = await auth.api.signInEmail({
      body: {
        email: "admin@atmosphere.cafe",
        password: "adminpassword123",
      },
      asResponse: true,
    });
    adminCookie = signInResult.headers.get("set-cookie") || "";
  });

  it("Executes the complete customer booking, payment webhook, e-ticket, QR check-in, and kitchen queue cycle", async () => {
    const bookingDate = "2026-10-18";

    // 1. Customer searches availability (Langkah 1 & 2)
    const availReq = new NextRequest(
      `http://localhost:3000/api/availability?date=${bookingDate}&start=10:00&end=12:00&guests=4`
    );
    const availRes = await getAvailabilityRoute(availReq);
    expect(availRes.status).toBe(200);
    const availJson = await availRes.json();
    expect(availJson.success).toBe(true);
    const loft = availJson.data.rooms.find((r: { id: string }) => r.id === roomId);
    expect(loft.available).toBe(true);

    // 2. Customer loads catalog menu (Langkah 3)
    const menuRes = await getMenuRoute();
    expect(menuRes.status).toBe(200);
    const menuJson = await menuRes.json();
    expect(menuJson.success).toBe(true);
    expect(menuJson.data.categories.length).toBeGreaterThan(0);

    // 3. Customer checks out with R-C1 cart, custom serving time, and notes (Langkah 4)
    const checkoutReq = new NextRequest("http://localhost:3000/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        date: bookingDate,
        start: "10:00",
        end: "12:00",
        guestCount: 4,
        items: [
          { productId: foodId, option: null, quantity: 2 },
          { productId: drinkId, option: "Ice", quantity: 2 },
        ],
        servingTime: "AFTER_30_MIN",
        kitchenNote: "Jangan terlalu pedas, jeruk ice manis sedang",
        customer: {
          name: "Siti Rahma",
          phone: "0812-9876-5432",
          email: "siti@example.com",
        },
      }),
    });

    const checkoutRes = await createReservationRoute(checkoutReq);
    expect(checkoutRes.status).toBe(201);
    const checkoutJson = await checkoutRes.json();
    expect(checkoutJson.success).toBe(true);

    const { code, ticketToken, totalAmount, snapToken } = checkoutJson.data;
    expect(code).toMatch(/^ATM-/);
    expect(ticketToken).toBeDefined();
    expect(totalAmount).toBe(87000); // (28000 * 2) + (15500 * 2) = 56000 + 31000 = 87000
    expect(snapToken).toBeDefined();

    // 4. Ticket is initially PENDING_PAYMENT (Langkah 5)
    const ticketPendingRes = await getTicketRoute(
      new NextRequest(`http://localhost:3000/api/tickets/${ticketToken}`),
      { params: Promise.resolve({ token: ticketToken }) }
    );
    expect(ticketPendingRes.status).toBe(200);
    const ticketPendingJson = await ticketPendingRes.json();
    expect(ticketPendingJson.data.status).toBe("PENDING_PAYMENT");

    // 5. Payment gateway webhook settlement arrives
    const notifReq = new NextRequest(
      "http://localhost:3000/api/payments/midtrans/notification",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: code,
          status_code: "200",
          transaction_status: "settlement",
          gross_amount: "87000",
          payment_type: "qris",
        }),
      }
    );
    const notifRes = await notificationRoute(notifReq);
    expect(notifRes.status).toBe(200);

    // 6. Ticket is now CONFIRMED and has checkInUrl for QR code
    const ticketConfirmedRes = await getTicketRoute(
      new NextRequest(`http://localhost:3000/api/tickets/${ticketToken}`),
      { params: Promise.resolve({ token: ticketToken }) }
    );
    const ticketConfirmedJson = await ticketConfirmedRes.json();
    expect(ticketConfirmedJson.data.status).toBe("CONFIRMED");
    expect(ticketConfirmedJson.data.checkInUrl).toContain(`/admin/check-in/${code}`);

    // 7. Customer can lookup their booking from /cek-reservasi
    const lookupReq = new NextRequest("http://localhost:3000/api/tickets/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        phone: "081298765432",
      }),
    });
    const lookupRes = await lookupTicketRoute(lookupReq);
    expect(lookupRes.status).toBe(200);
    const lookupJson = await lookupRes.json();
    expect(lookupJson.data.ticketToken).toBe(ticketToken);

    // 8. Staff scans QR code -> loads summary at /admin/check-in/[code]
    const scannerReq = new NextRequest(
      `http://localhost:3000/api/admin/check-in/${code}`,
      { headers: { cookie: adminCookie } }
    );
    const scannerRes = await getAdminCheckInSummaryRoute(scannerReq, {
      params: Promise.resolve({ code }),
    });
    expect(scannerRes.status).toBe(200);
    const scannerJson = await scannerRes.json();
    expect(scannerJson.success).toBe(true);
    expect(scannerJson.data.customerName).toBe("Siti Rahma");
    expect(scannerJson.data.room.name).toBe("The Loft");
    expect(scannerJson.data.items).toHaveLength(2);

    const reservationId = scannerJson.data.id;

    // Premature check-in before H-day is rejected with 422 (R-S1)
    const prematureReq = new NextRequest(
      `http://localhost:3000/api/admin/reservations/${reservationId}/check-in`,
      {
        method: "POST",
        headers: { cookie: adminCookie },
      }
    );
    const prematureRes = await postAdminCheckInRoute(prematureReq, {
      params: Promise.resolve({ id: reservationId }),
    });
    expect(prematureRes.status).toBe(422);

    // Fast-forward to H-day (today WIB)
    const now = new Date();
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        startAt: now,
        endAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      },
    });

    // 9. Staff clicks Check-In on H-day -> status becomes CHECKED_IN
    const checkInReq = new NextRequest(
      `http://localhost:3000/api/admin/reservations/${reservationId}/check-in`,
      {
        method: "POST",
        headers: { cookie: adminCookie },
      }
    );
    const checkInRes = await postAdminCheckInRoute(checkInReq, {
      params: Promise.resolve({ id: reservationId }),
    });
    expect(checkInRes.status).toBe(200);
    const checkInJson = await checkInRes.json();
    expect(checkInJson.data.status).toBe("CHECKED_IN");

    // 10. Kitchen dashboard displays recap and item totals for today
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const kitchenReq = new NextRequest(
      `http://localhost:3000/api/admin/kitchen?date=${todayStr}`,
      { headers: { cookie: adminCookie } }
    );
    const kitchenRes = await getAdminKitchenRoute(kitchenReq);
    expect(kitchenRes.status).toBe(200);
    const kitchenJson = await kitchenRes.json();
    expect(kitchenJson.success).toBe(true);

    // Verify kitchen totals
    const foodTotal = kitchenJson.data.totals.find(
      (t: { productName: string }) => t.productName === "Pasta Aglio Olio"
    );
    expect(foodTotal.quantity).toBe(2);

    const drinkTotal = kitchenJson.data.totals.find(
      (t: { productName: string; option: string }) =>
        t.productName === "Jeruk" && t.option === "Ice"
    );
    expect(drinkTotal.quantity).toBe(2);

    // Verify queue entry has effectiveServingAt (10:30 WIB because servingTime is AFTER_30_MIN)
    const queuedRes = kitchenJson.data.reservations.find(
      (r: { code: string }) => r.code === code
    );
    expect(queuedRes).toBeDefined();
    expect(new Date(queuedRes.effectiveServingAt).getTime()).toBe(
      now.getTime() + 30 * 60 * 1000
    );

    // 11. Staff marks reservation as COMPLETED
    const completeReq = new NextRequest(
      `http://localhost:3000/api/admin/reservations/${reservationId}/complete`,
      {
        method: "POST",
        headers: { cookie: adminCookie },
      }
    );
    const completeRes = await postAdminCompleteRoute(completeReq, {
      params: Promise.resolve({ id: reservationId }),
    });
    expect(completeRes.status).toBe(200);
    const completeJson = await completeRes.json();
    expect(completeJson.data.status).toBe("COMPLETED");
  });
});
