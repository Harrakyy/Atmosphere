export interface PaymentItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email?: string;
}

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  items: PaymentItem[];
  customer: CustomerInfo;
  enabledPayments: string[];
  expiryMinutes: number;
}

export interface CreatePaymentResult {
  token: string;
  redirectUrl: string;
}

export type VerifyNotificationResult =
  | { valid: false }
  | {
      valid: true;
      orderId: string;
      status: "PAID" | "PENDING" | "FAILED";
      grossAmount: number;
      paymentType: string;
      raw: unknown;
    };

export interface PaymentGateway {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyNotification(body: unknown): Promise<VerifyNotificationResult>;
}
