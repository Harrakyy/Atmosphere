import { prisma } from "./db";
import { AppError } from "./http";
import { Setting } from "@prisma/client";
import { parseQris } from "./qris";

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
  // R-Q1: string kosong boleh (QRIS belum diatur), selain itu wajib QRIS statis yang valid
  if (data.qrisPayload) {
    const qris = parseQris(data.qrisPayload);
    if (!qris.ok) throw new AppError("VALIDATION_ERROR", qris.error, 400);
    data = { ...data, qrisPayload: data.qrisPayload.trim() };
  }
  if (merged.minDurationMinutes > merged.maxDurationMinutes) {
    throw new AppError("VALIDATION_ERROR", "Durasi minimal tidak boleh melebihi durasi maksimal.", 400);
  }

  return db.setting.update({ where: { id: 1 }, data });
}
