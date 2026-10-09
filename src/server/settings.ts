import { prisma } from "./db";
import { Prisma } from "@prisma/client";

export async function getSettings(db = prisma) {
  let setting = await db.setting.findUnique({ where: { id: 1 } });
  if (!setting) {
    setting = await db.setting.create({
      data: { id: 1 },
    });
  }
  return setting;
}

export async function updateSettings(
  data: Prisma.SettingUpdateInput,
  db = prisma
) {
  return db.setting.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1 },
  });
}
