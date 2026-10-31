import crypto from "node:crypto";

export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 4;

// R-I1: 4 karakter, minimal 1 huruf dan 1 angka. Diulang (bukan dipaksakan) supaya distribusinya tetap merata.
export function generateCode(): string {
  for (;;) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
    }
    if (/[A-Z]/.test(code) && /[2-9]/.test(code)) return code;
  }
}

export function generateTicketToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

