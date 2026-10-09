import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { adminRefundDoneSchema } from "@/contracts";
import { markRefundDone } from "@/server/reservations/transitions";
import { ok, handleError } from "@/server/http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin(request);
    const { id } = await params;
    const json = await request.json().catch(() => ({}));
    const validated = adminRefundDoneSchema.parse(json);

    const data = await markRefundDone(id, validated, session.user.id);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
