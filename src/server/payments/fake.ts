import {
  PaymentGateway,
  CreatePaymentInput,
  CreatePaymentResult,
  VerifyNotificationResult,
} from "./gateway";

export class FakeGateway implements PaymentGateway {
  private failNext = false;

  setShouldFail(shouldFail: boolean) {
    this.failNext = shouldFail;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("FakeGateway simulated payment creation failure");
    }

    return {
      token: `fake_snap_token_${input.orderId}`,
      redirectUrl: `https://app.sandbox.midtrans.com/snap/v2/vtweb/fake_${input.orderId}`,
    };
  }

  async verifyNotification(body: unknown): Promise<VerifyNotificationResult> {
    if (!body || typeof body !== "object") {
      return { valid: false };
    }

    const payload = body as Record<string, unknown>;
    return {
      valid: true,
      orderId: String(payload.order_id || payload.orderId || "unknown"),
      status: "PAID",
      grossAmount: Number(payload.gross_amount || payload.grossAmount || 0),
      paymentType: String(payload.payment_type || "other_qris"),
      raw: body,
    };
  }
}

export const fakeGateway = new FakeGateway();
