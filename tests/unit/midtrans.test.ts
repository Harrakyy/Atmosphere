import { describe, it, expect, vi, beforeEach } from "vitest";
import { MidtransGateway } from "@/server/payments/midtrans";
import crypto from "node:crypto";

describe("MidtransGateway", () => {
  const serverKey = "SB-Mid-server-test-key-12345";
  let gateway: MidtransGateway;

  beforeEach(() => {
    vi.restoreAllMocks();
    gateway = new MidtransGateway({
      serverKey,
      isProduction: false,
    });
  });

  describe("createPayment", () => {
    it("calls snap API with basic auth and returns token and redirectUrl", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          token: "snap-token-abc-123",
          redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/abc-123",
        }),
      });
      global.fetch = mockFetch;

      const result = await gateway.createPayment({
        orderId: "ATM-TEST01",
        amount: 50000,
        items: [
          { id: "p1", name: "Pasta", price: 28000, quantity: 1 },
          { id: "p2", name: "Jeruk (Ice)", price: 22000, quantity: 1 },
        ],
        customer: {
          name: "Budi",
          phone: "628123456789",
          email: "budi@example.com",
        },
        enabledPayments: ["other_qris", "gopay"],
        expiryMinutes: 15,
      });

      expect(result.token).toBe("snap-token-abc-123");
      expect(result.redirectUrl).toBe("https://app.sandbox.midtrans.com/snap/v2/vtweb/abc-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://app.sandbox.midtrans.com/snap/v1/transactions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("throws error if Midtrans returns non-OK response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Midtrans error message",
      });

      await expect(
        gateway.createPayment({
          orderId: "ATM-FAIL01",
          amount: 50000,
          items: [],
          customer: { name: "Budi", phone: "628123456" },
          enabledPayments: ["other_qris"],
          expiryMinutes: 15,
        })
      ).rejects.toThrow(/Midtrans error/);
    });
  });

  describe("verifyNotification", () => {
    it("rejects invalid signature (R-PAY1)", async () => {
      const invalidPayload = {
        order_id: "ATM-TEST01",
        status_code: "200",
        gross_amount: "50000.00",
        signature_key: "invalid-signature-key-hex",
      };

      const result = await gateway.verifyNotification(invalidPayload);
      expect(result.valid).toBe(false);
    });

    it("verifies signature and calls status API mapping settlement to PAID", async () => {
      const orderId = "ATM-TEST01";
      const statusCode = "200";
      const grossAmount = "50000.00";
      const validSignature = crypto
        .createHash("sha512")
        .update(orderId + statusCode + grossAmount + serverKey)
        .digest("hex");

      const webhookPayload = {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: validSignature,
      };

      // Mock status API GET /v2/{order_id}/status
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          order_id: orderId,
          transaction_status: "settlement",
          gross_amount: "50000.00",
          payment_type: "qris",
        }),
      });

      const result = await gateway.verifyNotification(webhookPayload);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.status).toBe("PAID");
        expect(result.orderId).toBe(orderId);
        expect(result.grossAmount).toBe(50000);
        expect(result.paymentType).toBe("qris");
      }
    });

    it("maps capture with accept to PAID and pending to PENDING and expire to FAILED", async () => {
      const orderId = "ATM-TEST02";
      const statusCode = "200";
      const grossAmount = "75000";
      const validSignature = crypto
        .createHash("sha512")
        .update(orderId + statusCode + grossAmount + serverKey)
        .digest("hex");

      const webhookPayload = {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: validSignature,
      };

      // 1. capture + accept
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          order_id: orderId,
          transaction_status: "capture",
          fraud_status: "accept",
          gross_amount: "75000",
          payment_type: "credit_card",
        }),
      });
      const res1 = await gateway.verifyNotification(webhookPayload);
      expect(res1.valid && res1.status).toBe("PAID");

      // 2. pending
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          order_id: orderId,
          transaction_status: "pending",
          gross_amount: "75000",
          payment_type: "bca_va",
        }),
      });
      const res2 = await gateway.verifyNotification(webhookPayload);
      expect(res2.valid && res2.status).toBe("PENDING");

      // 3. expire
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          order_id: orderId,
          transaction_status: "expire",
          gross_amount: "75000",
          payment_type: "qris",
        }),
      });
      const res3 = await gateway.verifyNotification(webhookPayload);
      expect(res3.valid && res3.status).toBe("FAILED");
    });
  });
});
