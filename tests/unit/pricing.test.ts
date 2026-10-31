import { describe, it, expect } from "vitest";
import { onlinePrice } from "@/server/pricing";

describe("pricing.ts R-P1", () => {
  it("onlinePrice matches all test vectors using integer math", () => {
    const settings = { markupBps: 300, roundingUnit: 500 };

    expect(onlinePrice(27000, settings)).toBe(28000);
    expect(onlinePrice(5000, settings)).toBe(5500);
    expect(onlinePrice(19000, settings)).toBe(20000);
    expect(onlinePrice(9000, settings)).toBe(9500);
    expect(onlinePrice(15000, settings)).toBe(15500);
    expect(onlinePrice(35000, settings)).toBe(36500);
  });

  it("K-36: markup 0% membiarkan harga kasir yang sudah kelipatan Rp500", () => {
    expect(onlinePrice(27000, { markupBps: 0, roundingUnit: 500 })).toBe(27000);
    expect(onlinePrice(5000, {})).toBe(5000);
  });

});
