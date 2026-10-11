import { describe, it, expect, vi, afterEach } from "vitest";
import { getPaymentGateway } from "@/server/payments/notification";
import { fakeGateway } from "@/server/payments/fake";
import { midtransGateway } from "@/server/payments/midtrans";

describe("getPaymentGateway", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("picks gateway from PAYMENT_GATEWAY", () => {
    vi.stubEnv("PAYMENT_GATEWAY", "fake");
    expect(getPaymentGateway()).toBe(fakeGateway);
    vi.stubEnv("PAYMENT_GATEWAY", "midtrans");
    expect(getPaymentGateway()).toBe(midtransGateway);
  });

  it("refuses FakeGateway in production (it accepts any webhook as paid)", () => {
    vi.stubEnv("PAYMENT_GATEWAY", "fake");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getPaymentGateway()).toThrow();
  });
});
