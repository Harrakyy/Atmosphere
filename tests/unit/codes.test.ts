import { describe, it, expect } from "vitest";
import { generateCode, generateTicketToken } from "@/server/codes";

describe("codes.ts R-I1 and R-I2", () => {
  it("generateCode generates ATM-XXXXXX with valid characters and no forbidden chars", () => {
    const codeRegex = /^ATM-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
    const forbiddenChars = /[0O1IL]/;

    for (let i = 0; i < 10000; i++) {
      const code = generateCode();
      expect(code).toMatch(codeRegex);
      expect(forbiddenChars.test(code)).toBe(false);
    }
  });

  it("generateTicketToken generates 32-character base64url string", () => {
    const token = generateTicketToken();
    expect(token).toHaveLength(32);
    expect(/^[A-Za-z0-9_-]{32}$/.test(token)).toBe(true);
  });
});
