import { NextRequest } from "next/server";
import { authenticateDevice, deviceHistory } from "@/server/devices";
import { ok, handleError } from "@/server/http";

// Protokol Setor §6: riwayat laporan untuk Setor yang dipasang ulang / HP baru
export async function POST(request: NextRequest) {
  try {
    await authenticateDevice(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
    return ok(await deviceHistory());
  } catch (error) {
    return handleError(error);
  }
}
