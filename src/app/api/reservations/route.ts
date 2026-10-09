import { NextRequest } from "next/server";
import { createReservationSchema } from "@/contracts";
import { createReservation } from "@/server/reservations/create";
import { ok, handleError } from "@/server/http";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const validated = createReservationSchema.parse(json);
    const result = await createReservation(validated);
    return ok(result, 201);
  } catch (error) {
    return handleError(error);
  }
}
