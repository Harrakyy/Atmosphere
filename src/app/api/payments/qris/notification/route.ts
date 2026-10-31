import { NextRequest } from "next/server";
import { incomingPaymentSchema } from "@/contracts";
import { authenticateDevice } from "@/server/devices";
import { handleIncomingPayment } from "@/server/payments/incoming";
import { hitRateLimit } from "@/server/rate-limit";
import { AppError, ok, handleError } from "@/server/http";

// Dipanggil aplikasi SetorPantau di HP kasir setiap ada notifikasi DANA "Pembayaran Masuk" (K-35)
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const device = await authenticateDevice(token);
    const limit = hitRateLimit(`incoming:${device.id}`, 120, 60 * 1000);
    if (!limit.ok) throw new AppError("RATE_LIMITED", "Terlalu banyak laporan dari perangkat ini.", 429);
    const input = incomingPaymentSchema.parse(await request.json());
    return ok(await handleIncomingPayment(device, input));
  } catch (error) {
    return handleError(error);
  }
}
