import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { createPairingCode, listDevices } from "@/server/devices";
import { ok, handleError } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return ok(await listDevices());
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(request);
    return ok(await createPairingCode(session.user.id), 201);
  } catch (error) {
    return handleError(error);
  }
}
