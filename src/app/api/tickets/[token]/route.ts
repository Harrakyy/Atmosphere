import { NextRequest } from "next/server";
import { getTicketByToken } from "@/server/reservations/queries";
import { ok, handleError } from "@/server/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const ticket = await getTicketByToken(token);
    return ok(ticket);
  } catch (error) {
    return handleError(error);
  }
}
