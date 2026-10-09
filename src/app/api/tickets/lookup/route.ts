import { NextRequest } from "next/server";
import { lookupTicketSchema } from "@/contracts";
import { lookupTicket } from "@/server/reservations/queries";
import { ok, handleError } from "@/server/http";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const validated = lookupTicketSchema.parse(json);
    const result = await lookupTicket(validated);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}
