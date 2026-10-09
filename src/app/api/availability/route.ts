import { NextRequest } from "next/server";

import { availabilityQuerySchema } from "@/contracts";
import { getAvailability } from "@/server/availability";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = availabilityQuerySchema.parse({
      date: searchParams.get("date"),
      start: searchParams.get("start"),
      end: searchParams.get("end"),
      guests: searchParams.get("guests"),
    });

    const data = await getAvailability(query);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
