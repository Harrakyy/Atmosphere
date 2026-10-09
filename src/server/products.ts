import { prisma } from "./db";
import { NotFoundError } from "./http";
import { onlinePrice } from "./pricing";
import { Prisma } from "@prisma/client";

export async function getAdminProducts(db = prisma) {
  const setting = await db.setting.findUnique({ where: { id: 1 } });
  const markupBps = setting?.markupBps ?? 300;
  const roundingUnit = setting?.roundingUnit ?? 500;

  const products = await db.product.findMany({
    include: { category: true },
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
  });

  return products.map((p) => ({
    ...p,
    onlinePrice: onlinePrice(p.basePrice, { markupBps, roundingUnit }),
  }));
}

export async function createProduct(
  data: Prisma.ProductCreateInput,
  db = prisma
) {
  const setting = await db.setting.findUnique({ where: { id: 1 } });
  const p = await db.product.create({
    data,
    include: { category: true },
  });
  return {
    ...p,
    onlinePrice: onlinePrice(p.basePrice, {
      markupBps: setting?.markupBps ?? 300,
      roundingUnit: setting?.roundingUnit ?? 500,
    }),
  };
}

export async function updateProduct(
  id: string,
  data: Prisma.ProductUpdateInput,
  db = prisma
) {
  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Produk tidak ditemukan.");

  const setting = await db.setting.findUnique({ where: { id: 1 } });
  const p = await db.product.update({
    where: { id },
    data,
    include: { category: true },
  });
  return {
    ...p,
    onlinePrice: onlinePrice(p.basePrice, {
      markupBps: setting?.markupBps ?? 300,
      roundingUnit: setting?.roundingUnit ?? 500,
    }),
  };
}

export async function archiveProduct(id: string, db = prisma) {
  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Produk tidak ditemukan.");

  return db.product.update({
    where: { id },
    data: { isArchived: true },
  });
}
