import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { listDevices } from "@/server/devices";
import { ok, handleError } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return ok(await listDevices());
  } catch (error) {
    return handleError(error);
  }
}
