import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { createPairingCode } from "@/server/devices";
import { ok, handleError } from "@/server/http";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(request);
    return ok(await createPairingCode(session.user.id), 201);
  } catch (error) {
    return handleError(error);
  }
}
