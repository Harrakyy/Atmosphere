import { NextRequest } from "next/server";
import { qrisNotificationSchema } from "@/contracts";
import { recordQrisNotification, requireDevice } from "@/server/devices";
import { ok, handleError } from "@/server/http";

// K-35: notifikasi DANA "Pembayaran Masuk" dari HP kasir → cocokkan nominal unik (R-Q3) → reservasi Lunas
export async function POST(request: NextRequest) {
  try {
    const device = await requireDevice(request);
    const input = qrisNotificationSchema.parse(await request.json());
    return ok(await recordQrisNotification(device.id, input));
  } catch (error) {
    return handleError(error);
  }
}
