import crypto from "node:crypto";
import {
  PaymentGateway,
  CreatePaymentInput,
  CreatePaymentResult,
  VerifyNotificationResult,
} from "./gateway";

export interface MidtransGatewayConfig {
  serverKey?: string;
  isProduction?: boolean;
}

export class MidtransGateway implements PaymentGateway {
  private serverKey: string;
  private snapBase: string;
  private apiBase: string;

  constructor(config: MidtransGatewayConfig = {}) {
    this.serverKey =
      config.serverKey ||
      process.env.MIDTRANS_SERVER_KEY ||
      "SB-Mid-server-placeholder";
    const isProduction =
      config.isProduction ??
      (process.env.MIDTRANS_IS_PRODUCTION === "true");

    this.snapBase = isProduction
      ? "https://app.midtrans.com"
      : "https://app.sandbox.midtrans.com";
    this.apiBase = isProduction
      ? "https://api.midtrans.com"
      : "https://api.sandbox.midtrans.com";
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.serverKey}:`).toString("base64")}`;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const payload = {
      transaction_details: {
        order_id: input.orderId,
        gross_amount: input.amount,
      },
      item_details: input.items.map((item) => ({
        id: item.id,
        price: item.price,
        quantity: item.quantity,
        name: item.name.slice(0, 50),
      })),
      customer_details: {
        first_name: input.customer.name,
        phone: input.customer.phone,
        email: input.customer.email || undefined,
      },
      enabled_payments: input.enabledPayments,
      expiry: {
        unit: "minute",
        duration: input.expiryMinutes,
      },
    };

    const res = await fetch(`${this.snapBase}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Midtrans createPayment failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      token: data.token,
      redirectUrl: data.redirect_url,
    };
  }

  async verifyNotification(body: unknown): Promise<VerifyNotificationResult> {
    if (!body || typeof body !== "object") {
      return { valid: false };
    }

    const payload = body as Record<string, unknown>;
    const orderId = String(payload.order_id || "");
    const statusCode = String(payload.status_code || "");
    const grossAmount = String(payload.gross_amount || "");
    const signatureKey = String(payload.signature_key || "");

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      return { valid: false };
    }

    // R-PAY1: SHA512(order_id + status_code + gross_amount + serverKey)
    const expectedSignature = crypto
      .createHash("sha512")
      .update(orderId + statusCode + grossAmount + this.serverKey)
      .digest("hex");

    const sigBuf = Buffer.from(signatureKey, "utf-8");
    const expectedBuf = Buffer.from(expectedSignature, "utf-8");

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false };
    }

    // R-PAY2: Cek status resmi ke API Midtrans
    const statusRes = await fetch(`${this.apiBase}/v2/${orderId}/status`, {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
    });

    if (!statusRes.ok) {
      // Signature sudah valid; gagal cek status → 500 supaya Midtrans mengirim ulang, bukan 401
      throw new Error(`Midtrans status check failed (${statusRes.status})`);
    }

    const statusData = (await statusRes.json()) as Record<string, unknown>;
    const transactionStatus = String(statusData.transaction_status || "");
    const fraudStatus = String(statusData.fraud_status || "");

    let status: "PAID" | "PENDING" | "FAILED";

    if (transactionStatus === "settlement") {
      status = "PAID";
    } else if (transactionStatus === "capture") {
      status = fraudStatus === "accept" ? "PAID" : "PENDING";
    } else if (transactionStatus === "pending") {
      status = "PENDING";
    } else {
      status = "FAILED";
    }

    return {
      valid: true,
      orderId: String(statusData.order_id || orderId),
      status,
      grossAmount: Math.round(Number(statusData.gross_amount || grossAmount)),
      paymentType: String(statusData.payment_type || "unknown"),
      raw: statusData,
    };
  }
}

export const midtransGateway = new MidtransGateway();
