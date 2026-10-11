import { prisma } from "./db";
import { AppError } from "./http";
import { Setting } from "@prisma/client";

export async function getSettings(db = prisma) {
  let setting = await db.setting.findUnique({ where: { id: 1 } });
  if (!setting) {
    setting = await db.setting.create({
      data: { id: 1 },
    });
  }
  return setting;
}

type SettingPatch = Partial<Omit<Setting, "id" | "updatedAt">>;

export async function updateSettings(data: SettingPatch, db = prisma) {
  // Invariant dicek pada nilai gabungan, supaya PATCH sebagian tidak bisa melanggarnya
  const merged = { ...(await getSettings(db)), ...data };
  if (merged.openTime >= merged.closeTime) {
    throw new AppError("VALIDATION_ERROR", "Jam buka harus lebih awal dari jam tutup.", 400);
  }
  if (merged.paymentExpiryMinutes >= merged.holdMinutes) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Waktu kedaluwarsa pembayaran harus lebih kecil dari waktu tahan slot.",
      400
    );
  }
  if (merged.minDurationMinutes > merged.maxDurationMinutes) {
    throw new AppError("VALIDATION_ERROR", "Durasi minimal tidak boleh melebihi durasi maksimal.", 400);
  }

  return db.setting.update({ where: { id: 1 }, data });
}
