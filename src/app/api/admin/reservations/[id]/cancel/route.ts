import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { adminCancelSchema } from "@/contracts";
import { cancelReservation } from "@/server/reservations/transitions";
import { cancelLink } from "@/server/wa";
import { prisma } from "@/server/db";
import { ok, handleError } from "@/server/http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin(request);
    const { id } = await params;
    const json = await request.json();
    const validated = adminCancelSchema.parse(json);

    const reservation = await cancelReservation(
      id,
      validated,
      session.user.id
    );

    const fullRes = await prisma.reservation.findUnique({
      where: { id },
      include: { room: true },
    });

    const wa = cancelLink({
      by: reservation.cancelledBy ?? "CAFE",
      customerPhone: reservation.customerPhone,
      customerName: reservation.customerName,
      code: reservation.code,
      roomName: fullRes?.room.name ?? "",
      start: reservation.startAt,
      end: reservation.endAt,
      reason: reservation.cancelReason ?? undefined,
      totalAmount: reservation.totalAmount,
      refundAmount: reservation.refundAmount,
    });

    return ok({ reservation, waLink: wa });
  } catch (error) {
    return handleError(error);
  }
}
