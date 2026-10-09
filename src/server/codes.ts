import crypto from "node:crypto";

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateCode(): string {
  let result = "ATM-";
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, CODE_ALPHABET.length);
    result += CODE_ALPHABET[randomIndex];
  }
  return result;
}

export function generateTicketToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}
