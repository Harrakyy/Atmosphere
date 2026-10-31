import { NextRequest } from "next/server";
import { devicePairSchema } from "@/contracts";
import { pairDevice } from "@/server/devices";
import { hitRateLimit } from "@/server/rate-limit";
import { AppError, ok, handleError } from "@/server/http";

// K-35: HP kasir menukar kode pairing (dari Admin → Pengaturan) dengan token perangkat
export async function POST(request: NextRequest) {
  try {
    // shortcut: x-forwarded-for dipercaya karena deploy di Vercel (K-24); di luar Vercel pakai IP dari proxy tepercaya
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    const limit = hitRateLimit(`pair:${ip}`, 10, 10 * 60 * 1000);
    if (!limit.ok) {
      throw new AppError("RATE_LIMITED", `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(limit.retryAfterSec / 60)} menit.`, 429);
    }
    const { code, name } = devicePairSchema.parse(await request.json());
    return ok(await pairDevice(code, name));
  } catch (error) {
    return handleError(error);
  }
}
