import { prisma } from "./db";
import { validateSchedule } from "./time-rules";
import { TimeRuleError } from "./http";
import { wibDateTime } from "./time";

export interface AvailabilityQuery {
  date: string;
  start: string;
  end: string;
  guests: number;
}

export interface RoomAvailabilityResult {
  id: string;
  name: string;
  location: string | null;
  minGuests: number;
  maxGuests: number;
  facilities: string[];
  photoUrl: string | null;
  available: boolean;
  reason: "CAPACITY_TOO_SMALL" | "BELOW_MIN_GUESTS" | "BOOKED" | "BLOCKED" | null;
}

export async function getAvailability(
  query: AvailabilityQuery,
  now: Date = new Date(),
  db = prisma
): Promise<{ rooms: RoomAvailabilityResult[] }> {
  const setting = await db.setting.findUnique({ where: { id: 1 } });
  const sched = validateSchedule(
    { date: query.date, start: query.start, end: query.end },
    setting ?? {},
    now
  );

  if (!sched.ok) {
    throw new TimeRuleError(sched.message, { rule: sched.rule });
  }

  const { startAt, endAt, blockEndAt } = sched;

  // R-A1: hanya ruangan non-arsip
  const rooms = await db.room.findMany({
    where: { isArchived: false },
    orderBy: { sortOrder: "asc" },
    include: {
      blocks: {
        where: {
          startAt: { lt: endAt },
          OR: [{ endAt: null }, { endAt: { gt: startAt } }],
        },
      },
      reservations: {
        where: {
          status: { in: ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] },
          // Filter candidate window
          startAt: { lt: blockEndAt },
          blockEndAt: { gt: startAt },
        },
      },
    },
  });

  const results: RoomAvailabilityResult[] = [];

  for (const room of rooms) {
    let available = true;
    let reason: RoomAvailabilityResult["reason"] = null;

    // R-A2: kapasitas tamu
    if (query.guests < room.minGuests) {
      available = false;
      reason = "BELOW_MIN_GUESTS";
    } else if (query.guests > room.maxGuests) {
      available = false;
      reason = "CAPACITY_TOO_SMALL";
    }

    // R-A4: cek blokir ruangan
    if (available) {
      for (const block of room.blocks) {
        const blockEnd = block.endAt ? block.endAt.getTime() : Infinity;
        if (startAt.getTime() < blockEnd && endAt.getTime() > block.startAt.getTime()) {
          available = false;
          reason = "BLOCKED";
          break;
        }
      }
    }

    // R-A3: cek reservasi aktif (dengan lazy expiry)
    if (available) {
      for (const res of room.reservations) {
        // Reservasi PENDING_PAYMENT yang sudah lewat holdExpiresAt dianggap kosong
        if (res.status === "PENDING_PAYMENT" && res.holdExpiresAt.getTime() <= now.getTime()) {
          continue;
        }

        // Cek overlap [startAt, blockEndAt)
        if (startAt.getTime() < res.blockEndAt.getTime() && blockEndAt.getTime() > res.startAt.getTime()) {
          available = false;
          reason = "BOOKED";
          break;
        }
      }
    }

    results.push({
      id: room.id,
      name: room.name,
      location: room.location,
      minGuests: room.minGuests,
      maxGuests: room.maxGuests,
      facilities: room.facilities,
      photoUrl: room.photoUrl,
      available,
      reason,
    });
  }

  return { rooms: results };
}

export async function getDayBusy(
  roomId: string,
  dateStr: string,
  now: Date = new Date(),
  db = prisma
): Promise<{ busy: { startAt: Date; endAt: Date }[] }> {
  const dayStart = wibDateTime(dateStr, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [reservations, blocks] = await Promise.all([
    db.reservation.findMany({
      where: {
        roomId,
        status: { in: ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] },
        startAt: { lt: dayEnd },
        blockEndAt: { gt: dayStart },
      },
    }),
    db.roomBlock.findMany({
      where: {
        roomId,
        startAt: { lt: dayEnd },
        OR: [{ endAt: null }, { endAt: { gt: dayStart } }],
      },
    }),
  ]);

  const busy: { startAt: Date; endAt: Date }[] = [];

  for (const res of reservations) {
    if (res.status === "PENDING_PAYMENT" && res.holdExpiresAt.getTime() <= now.getTime()) {
      continue;
    }
    busy.push({
      startAt: res.startAt,
      endAt: res.blockEndAt,
    });
  }

  for (const block of blocks) {
    busy.push({
      startAt: block.startAt < dayStart ? dayStart : block.startAt,
      endAt: block.endAt && block.endAt < dayEnd ? block.endAt : dayEnd,
    });
  }

  return { busy };
}
