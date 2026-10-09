import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { getKitchenRecap } from "@/server/kitchen";
import { todayWib } from "@/server/time";
import { ok, handleError } from "@/server/http";

import { z } from "zod";

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const rawDate = request.nextUrl.searchParams.get("date") || undefined;
    const validated = querySchema.parse({ date: rawDate });
    const targetDate = validated.date || todayWib();

    const data = await getKitchenRecap(targetDate);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
