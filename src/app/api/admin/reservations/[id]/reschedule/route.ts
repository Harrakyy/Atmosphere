import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { adminRescheduleSchema } from "@/contracts";
import { rescheduleReservation } from "@/server/reservations/transitions";
import { ok, handleError } from "@/server/http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin(request);
    const { id } = await params;
    const json = await request.json();
    const validated = adminRescheduleSchema.parse(json);

    const data = await rescheduleReservation(id, validated, session.user.id);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
