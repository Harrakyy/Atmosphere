import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { seed } from "../../prisma/seed";
import { createReservation } from "@/server/reservations/create";
import { handleNotification } from "@/server/payments/notification";
import { PaymentGateway } from "@/server/payments/gateway";
import { FakeGateway } from "@/server/payments/fake";
import { UnauthorizedError, NotFoundError } from "@/server/http";

describe("Webhook & Status Transitions Integration Tests (Day 2)", () => {
  let fakeGateway: FakeGateway;
  let testRoomId: string;
  let foodProductId: string;
  let drinkProductId: string;

  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.paymentNotification.deleteMany();
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

  async function createTestReservation(customDate = "2026-10-18", start = "10:00", end = "12:00") {
    const created = await createReservation(
      {
        roomId: testRoomId,
        date: customDate,
        start,
        end,
        guestCount: 5,
        items: [
          { productId: foodProductId, option: null, quantity: 2 },
          { productId: drinkProductId, option: "Ice", quantity: 2 },
        ],
        servingTime: "ON_ARRIVAL",
        customer: {
          name: "Budi Santoso",
          phone: "0812-3456-7890",
          email: "budi@example.com",
        },
      },
      {
        gateway: fakeGateway,
        now: new Date("2026-10-10T10:00:00+07:00"),
        db: prisma,
      }
    );

    return (await prisma.reservation.findUnique({
      where: { code: created.code },
    }))!;
  }

  it("#6. Webhook with invalid signature throws 401 and does not change status", async () => {
    const res = await createTestReservation();

    const mockGateway: PaymentGateway = {
      async createPayment() {
        return { token: "token", redirectUrl: "url" };
      },
      async verifyNotification() {
        return { valid: false };
      },
    };

    const payload = { order_id: res.code, transaction_status: "settlement" };

    await expect(
      handleNotification(payload, { gateway: mockGateway, db: prisma })
    ).rejects.toThrow(UnauthorizedError);

    // Verifikasi status tidak berubah
    const unchanged = await prisma.reservation.findUnique({ where: { id: res.id } });
    expect(unchanged?.status).toBe("PENDING_PAYMENT");

    // PaymentNotification tetap tersimpan untuk audit trail
    const notifications = await prisma.paymentNotification.findMany({
      where: { orderId: res.code },
    });
    expect(notifications.length).toBe(1);
    expect(notifications[0].signatureValid).toBe(false);
  });

  it("Webhook with unknown order_id throws 404", async () => {
    const mockGateway: PaymentGateway = {
      async createPayment() {
        return { token: "token", redirectUrl: "url" };
      },
      async verifyNotification() {
        return {
          valid: true,
          orderId: "NON-EXISTENT-CODE",
          status: "PAID",
          grossAmount: 100000,
          paymentType: "qris",
          raw: {},
        };
      },
    };

    await expect(
      handleNotification(
        { order_id: "NON-EXISTENT-CODE" },
        { gateway: mockGateway, db: prisma }
      )
    ).rejects.toThrow(NotFoundError);

    const saved = await prisma.paymentNotification.findFirst({
      where: { orderId: "NON-EXISTENT-CODE" },
    });
    expect(saved).not.toBeNull();
  });

  it("Normal payment settlement updates status to CONFIRMED with paidAt and paymentType", async () => {
    const res = await createTestReservation();

    const mockGateway: PaymentGateway = {
      async createPayment() {
        return { token: "token", redirectUrl: "url" };
      },
      async verifyNotification() {
        return {
          valid: true,
          orderId: res.code,
          status: "PAID",
          grossAmount: res.totalAmount,
          paymentType: "qris",
          raw: {},
        };
      },
    };

    const result = await handleNotification(
      { order_id: res.code, transaction_status: "settlement" },
      { gateway: mockGateway, db: prisma }
    );
    expect(result.received).toBe(true);

    const updated = await prisma.reservation.findUnique({ where: { id: res.id } });
    expect(updated?.status).toBe("CONFIRMED");
    expect(updated?.paidAt).not.toBeNull();
    expect(updated?.paymentType).toBe("qris");

    const logs = await prisma.activityLog.findMany({ where: { reservationId: res.id } });
    expect(logs.some((l) => l.action === "PAYMENT_CONFIRMED")).toBe(true);
  });

  it("#7. Idempotent settlement (2x webhook): single transition, single log, two PaymentNotifications", async () => {
    const res = await createTestReservation();

    const mockGateway: PaymentGateway = {
      async createPayment() {
        return { token: "token", redirectUrl: "url" };
      },
      async verifyNotification() {
        return {
          valid: true,
          orderId: res.code,
          status: "PAID",
          grossAmount: res.totalAmount,
          paymentType: "gopay",
          raw: {},
        };
      },
    };

    // Panggilan pertama
    await handleNotification(
      { order_id: res.code, transaction_status: "settlement" },
      { gateway: mockGateway, db: prisma }
    );

    // Panggilan kedua (duplikat)
    await handleNotification(
      { order_id: res.code, transaction_status: "settlement" },
      { gateway: mockGateway, db: prisma }
    );

    const updated = await prisma.reservation.findUnique({ where: { id: res.id } });
    expect(updated?.status).toBe("CONFIRMED");

    // Hanya 1 activity log PAYMENT_CONFIRMED (+ 1 RESERVATION_CREATED)
    const logs = await prisma.activityLog.findMany({
      where: { reservationId: res.id, action: "PAYMENT_CONFIRMED" },
    });
    expect(logs.length).toBe(1);

    // Namun tersimpan 2 PaymentNotification
    const notifications = await prisma.paymentNotification.findMany({
      where: { orderId: res.code },
    });
    expect(notifications.length).toBe(2);
  });

  it("Gross amount mismatch logs PAYMENT_AMOUNT_MISMATCH and does not confirm", async () => {
    const res = await createTestReservation();

    const mockGateway: PaymentGateway = {
      async createPayment() {
        return { token: "token", redirectUrl: "url" };
      },
      async verifyNotification() {
        return {
          valid: true,
          orderId: res.code,
          status: "PAID",
          grossAmount: res.totalAmount - 5000, // Nominal kurang
          paymentType: "qris",
          raw: {},
        };
      },
    };

    const result = await handleNotification(
      { order_id: res.code },
      { gateway: mockGateway, db: prisma }
    );
    expect(result.mismatch).toBe(true);

    const unchanged = await prisma.reservation.findUnique({ where: { id: res.id } });
    expect(unchanged?.status).toBe("PENDING_PAYMENT");

    const mismatchLog = await prisma.activityLog.findFirst({
      where: { reservationId: res.id, action: "PAYMENT_AMOUNT_MISMATCH" },
    });
    expect(mismatchLog).not.toBeNull();
  });

  it("#8. Late payment when slot is taken -> CANCELLED + full refund PENDING + LATE_PAYMENT_SLOT_TAKEN", async () => {
    // 1. Buat reservasi 1 (akan kedaluwarsa)
    const res1 = await createTestReservation("2026-10-18", "10:00", "12:00");
    await prisma.reservation.update({
      where: { id: res1.id },
      data: { status: "EXPIRED" },
    });

    // 2. Buat reservasi 2 di slot yang sama dan CONFIRMED
    const res2 = await createTestReservation("2026-10-18", "10:00", "12:00");
    await prisma.reservation.update({
      where: { id: res2.id },
      data: { status: "CONFIRMED" },
    });

    // 3. Webhook pembayaran datang untuk reservasi 1 yang sudah EXPIRED
    const mockGateway: PaymentGateway = {
      async createPayment() {
        return { token: "token", redirectUrl: "url" };
      },
      async verifyNotification() {
        return {
          valid: true,
          orderId: res1.code,
          status: "PAID",
          grossAmount: res1.totalAmount,
          paymentType: "bca_va",
          raw: {},
        };
      },
    };

    await handleNotification(
      { order_id: res1.code },
      { gateway: mockGateway, db: prisma }
    );

    const updatedRes1 = await prisma.reservation.findUnique({ where: { id: res1.id } });
    expect(updatedRes1?.status).toBe("CANCELLED");
    expect(updatedRes1?.cancelledBy).toBe("SYSTEM");
    expect(updatedRes1?.refundStatus).toBe("PENDING");
    expect(updatedRes1?.refundAmount).toBe(res1.totalAmount);

    const lateLog = await prisma.activityLog.findFirst({
      where: { reservationId: res1.id, action: "LATE_PAYMENT_SLOT_TAKEN" },
    });
    expect(lateLog).not.toBeNull();
  });

  it("Late payment when slot is still free -> successfully recovers to CONFIRMED", async () => {
    const res = await createTestReservation("2026-10-18", "14:00", "16:00");
    await prisma.reservation.update({
      where: { id: res.id },
      data: { status: "EXPIRED" },
    });

    const mockGateway: PaymentGateway = {
      async createPayment() {
        return { token: "token", redirectUrl: "url" };
      },
      async verifyNotification() {
        return {
          valid: true,
          orderId: res.code,
          status: "PAID",
          grossAmount: res.totalAmount,
          paymentType: "qris",
          raw: {},
        };
      },
    };

    await handleNotification(
      { order_id: res.code },
      { gateway: mockGateway, db: prisma }
    );

    const updated = await prisma.reservation.findUnique({ where: { id: res.id } });
    expect(updated?.status).toBe("CONFIRMED");
  });

  it("FAILED webhook expires PENDING_PAYMENT reservation", async () => {
    const res = await createTestReservation("2026-10-18", "16:00", "18:00");

    const mockGateway: PaymentGateway = {
      async createPayment() {
        return { token: "token", redirectUrl: "url" };
      },
      async verifyNotification() {
        return {
          valid: true,
          orderId: res.code,
          status: "FAILED",
          grossAmount: res.totalAmount,
          paymentType: "qris",
          raw: {},
        };
      },
    };

    await handleNotification(
      { order_id: res.code },
      { gateway: mockGateway, db: prisma }
    );

    const updated = await prisma.reservation.findUnique({ where: { id: res.id } });
    expect(updated?.status).toBe("EXPIRED");
  });

  it("Late payment on EXPIRED reservation with mismatched gross amount is rejected without confirming", async () => {
    const res = await createTestReservation("2026-10-18", "18:00", "20:00");
    await prisma.reservation.update({
      where: { id: res.id },
      data: { status: "EXPIRED" },
    });

    const mockGateway: PaymentGateway = {
      async createPayment() {
        return { token: "token", redirectUrl: "url" };
      },
      async verifyNotification() {
        return {
          valid: true,
          orderId: res.code,
          status: "PAID",
          grossAmount: res.totalAmount - 10000,
          paymentType: "qris",
          raw: {},
        };
      },
    };

    const result = await handleNotification(
      { order_id: res.code },
      { gateway: mockGateway, db: prisma }
    );
    expect(result.mismatch).toBe(true);

    const unchanged = await prisma.reservation.findUnique({ where: { id: res.id } });
    expect(unchanged?.status).toBe("EXPIRED");
  });
});
