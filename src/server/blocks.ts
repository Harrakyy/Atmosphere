import { prisma } from "./db";
import { NotFoundError } from "./http";

export async function getRoomBlocks(roomId: string, db = prisma) {
  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room) throw new NotFoundError("Ruangan tidak ditemukan.");

  return db.roomBlock.findMany({
    where: { roomId },
    orderBy: { startAt: "asc" },
  });
}

export async function createRoomBlock(
  roomId: string,
  input: {
    startAt: string | Date;
    endAt?: string | Date | null;
    reason: string;
  },
  actorId: string,
  db = prisma
) {
  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room) throw new NotFoundError("Ruangan tidak ditemukan.");

  const startAt = new Date(input.startAt);
  const endAt = input.endAt ? new Date(input.endAt) : null;

  return db.$transaction(async (tx) => {
    // Row lock room
    await tx.$queryRawUnsafe(`SELECT 1 FROM "Room" WHERE id = $1 FOR UPDATE`, roomId);

    const block = await tx.roomBlock.create({
      data: {
        roomId,
        startAt,
        endAt,
        reason: input.reason,
        createdById: actorId,
      },
    });

    // Cari konflik dengan reservasi aktif (R-B2)
    const conflicts = await tx.reservation.findMany({
      where: {
        roomId,
        OR: [
          { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
          { status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } },
        ],
        blockEndAt: { gt: startAt },
        ...(endAt ? { startAt: { lt: endAt } } : {}),
      },
      include: { room: true },
      orderBy: { startAt: "asc" },
    });

    await tx.activityLog.create({
      data: {
        actorId,
        action: "BLOCK_CREATED",
        detail: {
          blockId: block.id,
          roomId,
          conflictsCount: conflicts.length,
          conflictCodes: conflicts.map((c) => c.code),
        },
      },
    });

    return { block, conflicts };
  });
}

export async function deleteRoomBlock(
  blockId: string,
  actorId: string,
  db = prisma
) {
  const block = await db.roomBlock.findUnique({ where: { id: blockId } });
  if (!block) throw new NotFoundError("Blokir jadwal tidak ditemukan.");

  await db.roomBlock.delete({ where: { id: blockId } });

  await db.activityLog.create({
    data: {
      actorId,
      action: "BLOCK_DELETED",
      detail: {
        blockId,
        roomId: block.roomId,
      },
    },
  });

  return { success: true };
}
