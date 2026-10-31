import { NextRequest } from "next/server";
import { pairDeviceSchema } from "@/contracts";
import { pairDevice } from "@/server/devices";
import { hitRateLimit } from "@/server/rate-limit";
import { AppError, ok, handleError } from "@/server/http";

export async function POST(request: NextRequest) {
  try {
    // Kode pairing bisa ditebak kalau tidak dibatasi; 10 percobaan per 15 menit per IP
    // shortcut: x-forwarded-for dipercaya karena deploy di Vercel (K-24)
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    const limit = hitRateLimit(`pair:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.ok) throw new AppError("RATE_LIMITED", "Terlalu banyak percobaan. Coba lagi nanti.", 429);
    const input = pairDeviceSchema.parse(await request.json());
    return ok(await pairDevice(input), 201);
  } catch (error) {
    return handleError(error);
  }
}
