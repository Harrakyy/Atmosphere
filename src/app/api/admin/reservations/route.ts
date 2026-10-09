import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { getAdminReservations } from "@/server/reservations/queries";
import { ok, handleError } from "@/server/http";
import { ReservationStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");
    const statusParam = searchParams.get("status");
    const status = statusParam ? (statusParam as ReservationStatus) : null;

    const data = await getAdminReservations({ date, status });
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
