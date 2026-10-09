import { prisma } from "./db";
import { AppError, NotFoundError } from "./http";
import { Prisma } from "@prisma/client";

export async function getAdminCategories(db = prisma) {
  return db.category.findMany({
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createCategory(
  data: Prisma.CategoryCreateInput,
  db = prisma
) {
  return db.category.create({ data });
}

export async function updateCategory(
  id: string,
  data: Prisma.CategoryUpdateInput,
  db = prisma
) {
  const category = await db.category.findUnique({ where: { id } });
  if (!category) throw new NotFoundError("Kategori tidak ditemukan.");

  return db.category.update({
    where: { id },
    data,
  });
}

export async function deleteCategory(id: string, db = prisma) {
  const category = await db.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  if (!category) throw new NotFoundError("Kategori tidak ditemukan.");

  if (category._count.products > 0) {
    throw new AppError(
      "CATEGORY_NOT_EMPTY",
      "Kategori tidak dapat dihapus karena masih memiliki produk.",
      422
    );
  }

  return db.category.delete({ where: { id } });
}
