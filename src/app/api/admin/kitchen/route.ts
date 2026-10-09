import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { getKitchenRecap } from "@/server/kitchen";
import { todayWib } from "@/server/time";
import { ok, handleError } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const dateParam = request.nextUrl.searchParams.get("date") || todayWib();
    const data = await getKitchenRecap(dateParam);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
