import { prisma } from "./db";
import { onlinePrice } from "./pricing";

export async function getPublicMenu(db = prisma) {
  const setting = await db.setting.findUnique({ where: { id: 1 } });
  const pricingSettings = setting ?? {};

  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: {
          isAvailable: true,
          isArchived: false,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      products: c.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: onlinePrice(p.basePrice, pricingSettings),
        options: p.options,
        label: p.label,
        photoUrl: p.photoUrl,
      })),
    })),
  };
}
