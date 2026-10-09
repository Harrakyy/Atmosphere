import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { getNeedsActionReservations } from "@/server/reservations/queries";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const data = await getNeedsActionReservations();
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
