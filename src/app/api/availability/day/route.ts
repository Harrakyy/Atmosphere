import { NextRequest } from "next/server";

import { dayBusyQuerySchema } from "@/contracts";
import { getDayBusy } from "@/server/availability";
import { ok, handleError } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = dayBusyQuerySchema.parse({
      roomId: searchParams.get("roomId"),
      date: searchParams.get("date"),
    });

    const data = await getDayBusy(query.roomId, query.date);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
