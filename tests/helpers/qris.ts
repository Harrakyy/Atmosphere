import { PrismaClient } from "@prisma/client";

// QRIS statis DANA yang dipakai saat pengembangan (lihat tests/unit/qris.test.ts)
export const TEST_QRIS =
  "00020101021126570011ID.DANA.WWW011893600915303623183002090362318300303UMI51440014ID.CO.QRIS.WWW0215ID10266209157630303UMI5204581253033605802ID5925Plater squash mas aji, Ma6010Muara Enim61053171163044001";

export const setTestQris = (db: PrismaClient) =>
  db.setting.upsert({ where: { id: 1 }, update: { qrisPayload: TEST_QRIS }, create: { id: 1, qrisPayload: TEST_QRIS } });
