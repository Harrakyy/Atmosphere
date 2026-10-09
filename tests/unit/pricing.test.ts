import { describe, it, expect } from "vitest";
import { onlinePrice, enabledPayments } from "@/server/pricing";

describe("pricing.ts R-P1 and R-P4", () => {
  it("onlinePrice matches all test vectors using integer math", () => {
    const settings = { markupBps: 300, roundingUnit: 500 };

    expect(onlinePrice(27000, settings)).toBe(28000);
    expect(onlinePrice(5000, settings)).toBe(5500);
    expect(onlinePrice(19000, settings)).toBe(20000);
    expect(onlinePrice(9000, settings)).toBe(9500);
    expect(onlinePrice(15000, settings)).toBe(15500);
    expect(onlinePrice(35000, settings)).toBe(36500);
  });

  it("enabledPayments includes QRIS & e-wallets, and VA only when total >= vaMinTotal", () => {
    const settings = { vaMinTotal: 150000 };

    const belowVa = enabledPayments(149500, settings);
    expect(belowVa).toEqual(["other_qris", "gopay", "shopeepay"]);

    const atVa = enabledPayments(150000, settings);
    expect(atVa).toEqual([
      "other_qris",
      "gopay",
      "shopeepay",
      "bca_va",
      "bni_va",
      "bri_va",
      "permata_va",
      "cimb_va",
      "echannel",
    ]);

    const aboveVa = enabledPayments(200000, settings);
    expect(aboveVa).toContain("bca_va");
  });
});
