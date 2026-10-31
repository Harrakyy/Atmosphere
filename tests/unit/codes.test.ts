import { describe, it, expect } from "vitest";
import { generateCode, generateTicketToken } from "@/server/codes";

describe("codes.ts R-I1, R-I2", () => {
  it("R-I1: generateCode = 4 karakter, tanpa 0/O/1/I/L, selalu ada huruf dan angka", () => {
    for (let i = 0; i < 10000; i++) {
      const code = generateCode();
      expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
      expect(code).toMatch(/[A-Z]/);
      expect(code).toMatch(/[2-9]/);
    }
  });

  it("R-I2: generateTicketToken generates 32-character base64url string", () => {
    const token = generateTicketToken();
    expect(token).toHaveLength(32);
    expect(/^[A-Za-z0-9_-]{32}$/.test(token)).toBe(true);
  });

});
