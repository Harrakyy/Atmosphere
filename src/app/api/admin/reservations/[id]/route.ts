import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { getAdminReservationDetail } from "@/server/reservations/queries";
import { ok, handleError } from "@/server/http";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const data = await getAdminReservationDetail(id);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
