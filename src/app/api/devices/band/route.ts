import { NextRequest } from "next/server";
import { authenticateDevice, setBand } from "@/server/devices";
import { ok, handleError } from "@/server/http";

// Protokol Setor §5: rentang 3 digit diubah pemilik di app Setor
export async function POST(request: NextRequest) {
  try {
    await authenticateDevice(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
    const body = await request.json().catch(() => null);
    return ok({ band: await setBand(body?.band) });
  } catch (error) {
    return handleError(error);
  }
}
