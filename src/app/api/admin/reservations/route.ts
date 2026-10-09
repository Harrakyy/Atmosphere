import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { getAdminReservations } from "@/server/reservations/queries";
import { ok, handleError } from "@/server/http";
import { ReservationStatus } from "@prisma/client";

import { z } from "zod";

const querySchema = z.object({
  date: z.string().optional().nullable(),
  status: z.nativeEnum(ReservationStatus).optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const searchParams = request.nextUrl.searchParams;
    const validated = querySchema.parse({
      date: searchParams.get("date"),
      status: searchParams.get("status") || undefined,
    });

    const data = await getAdminReservations({
      date: validated.date,
      status: validated.status,
    });
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
