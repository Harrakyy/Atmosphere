import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { listUnmatchedPayments } from "@/server/payments/incoming";
import { ok, handleError } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return ok(await listUnmatchedPayments());
  } catch (error) {
    return handleError(error);
  }
}
