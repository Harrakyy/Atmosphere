import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { dismissIncomingPayment } from "@/server/payments/incoming";
import { ok, handleError } from "@/server/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin(request);
    const { id } = await params;
    await dismissIncomingPayment(id, session.user.id);
    return ok({ dismissed: true });
  } catch (error) {
    return handleError(error);
  }
}
