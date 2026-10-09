import { prisma } from "./db";
import { AppError, NotFoundError } from "./http";
import { Prisma } from "@prisma/client";

export async function getAdminRooms(db = prisma) {
  return db.room.findMany({
    orderBy: { sortOrder: "asc" },
  });
}

export async function createRoom(data: Prisma.RoomCreateInput, db = prisma) {
  return db.room.create({ data });
}

export async function updateRoom(
  id: string,
  data: Prisma.RoomUpdateInput,
  db = prisma
) {
  const room = await db.room.findUnique({ where: { id } });
  if (!room) throw new NotFoundError("Ruangan tidak ditemukan.");

  return db.room.update({
    where: { id },
    data,
  });
}

export async function archiveRoom(
  id: string,
  now: Date = new Date(),
  db = prisma
) {
  const room = await db.room.findUnique({ where: { id } });
  if (!room) throw new NotFoundError("Ruangan tidak ditemukan.");

  const activeReservations = await db.reservation.findFirst({
    where: {
      roomId: id,
      OR: [
        { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
        { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
      ],
      startAt: { gte: now },
    },
  });

  if (activeReservations) {
    throw new AppError(
      "ROOM_HAS_ACTIVE_RESERVATIONS",
      "Ruangan tidak dapat diarsipkan karena masih memiliki reservasi aktif di masa depan.",
      422
    );
  }

  return db.room.update({
    where: { id },
    data: { isArchived: true },
  });
}
