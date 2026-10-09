import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/server/phone";

describe("phone.ts R-D2 normalizer", () => {
  it("normalizes Indonesian phone numbers correctly", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizePhone("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizePhone("812-3456-7890")).toBe("6281234567890");
    expect(normalizePhone("6281234567890")).toBe("6281234567890");
  });

  it("throws error for invalid phone numbers", () => {
    expect(() => normalizePhone("12345")).toThrow("Nomor WhatsApp tidak valid");
    expect(() => normalizePhone("021-1234567")).toThrow("Nomor WhatsApp tidak valid");
    expect(() => normalizePhone("abc")).toThrow("Nomor WhatsApp tidak valid");
    expect(() => normalizePhone("")).toThrow("Nomor WhatsApp tidak valid");
  });
});
