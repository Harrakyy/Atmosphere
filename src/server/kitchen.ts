import { prisma } from "./db";
import { wibDateTime } from "./time";
import { CategoryKind } from "@prisma/client";

export function getEffectiveServingTime(reservation: {
  servingTime: string;
  startAt: Date;
  servingAt: Date | null;
}): Date {
  if (reservation.servingTime === "AFTER_30_MIN") {
    return new Date(reservation.startAt.getTime() + 30 * 60 * 1000);
  }
  if (reservation.servingTime === "CUSTOM" && reservation.servingAt) {
    return reservation.servingAt;
  }
  return reservation.startAt;
}

export async function getKitchenRecap(dateStr: string, db = prisma) {
  const startOfDay = wibDateTime(dateStr, "00:00");
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const reservations = await db.reservation.findMany({
    where: {
      startAt: { gte: startOfDay, lt: endOfDay },
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    },
    include: {
      room: true,
      items: true,
    },
  });

  // Urutkan berdasarkan waktu penyajian efektif
  const sorted = reservations
    .map((r) => ({
      ...r,
      effectiveServingAt: getEffectiveServingTime(r),
    }))
    .sort((a, b) => a.effectiveServingAt.getTime() - b.effectiveServingAt.getTime());

  // Hitung totals per (productName, option, kind)
  const totalsMap = new Map<
    string,
    { productName: string; option: string | null; kind: CategoryKind; quantity: number }
  >();

  for (const res of sorted) {
    for (const item of res.items) {
      const key = `${item.productName}:::${item.option ?? ""}:::${item.kind}`;
      const existing = totalsMap.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        totalsMap.set(key, {
          productName: item.productName,
          option: item.option,
          kind: item.kind,
          quantity: item.quantity,
        });
      }
    }
  }

  const totals = Array.from(totalsMap.values()).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.productName.localeCompare(b.productName);
  });

  return {
    reservations: sorted,
    totals,
  };
}
