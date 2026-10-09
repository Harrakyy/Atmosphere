import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { completeReservation } from "@/server/reservations/transitions";
import { ok, handleError } from "@/server/http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin(request);
    const { id } = await params;
    const data = await completeReservation(id, session.user.id);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
