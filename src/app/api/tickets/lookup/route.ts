import { NextRequest } from "next/server";
import { lookupTicketSchema } from "@/contracts";
import { lookupTicket } from "@/server/reservations/queries";
import { hitRateLimit } from "@/server/rate-limit";
import { AppError, ok, handleError } from "@/server/http";

const LOOKUP_LIMIT = 10;
const LOOKUP_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    // Kode 4 karakter bisa ditebak, jadi percobaan per IP dibatasi sebelum menyentuh database.
    // shortcut: x-forwarded-for dipercaya karena deploy di Vercel (K-24, header ditimpa platform); di luar Vercel pakai IP dari proxy tepercaya
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    const limit = hitRateLimit(`lookup:${ip}`, LOOKUP_LIMIT, LOOKUP_WINDOW_MS);
    if (!limit.ok) {
      throw new AppError(
        "RATE_LIMITED",
        `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(limit.retryAfterSec / 60)} menit.`,
        429
      );
    }

    const json = await request.json();
    const validated = lookupTicketSchema.parse(json);
    const result = await lookupTicket(validated);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}
