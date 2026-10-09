import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { getCheckInSummaryByCode } from "@/server/reservations/queries";
import { ok, handleError } from "@/server/http";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await requireAdmin(request);
    const { code } = await params;
    const data = await getCheckInSummaryByCode(code);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
