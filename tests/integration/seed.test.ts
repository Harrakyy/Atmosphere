import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { seed } from "../../prisma/seed";

describe("Database Seed", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.reservationItem.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.roomBlock.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.room.deleteMany();
  });

  it("seeds 80 products, 4 categories, 3 rooms, and 15 drinks have Hot|Ice options", async () => {
    await seed(prisma);

    const setting = await prisma.setting.findUnique({ where: { id: 1 } });
    expect(setting).toBeDefined();

    const rooms = await prisma.room.findMany();
    expect(rooms).toHaveLength(3);

    const categories = await prisma.category.findMany();
    expect(categories).toHaveLength(4);

    const products = await prisma.product.findMany({
      include: { category: true },
    });
    expect(products).toHaveLength(80);

    const hotIceDrinks = products.filter(
      (p) =>
        p.category.kind === "DRINK" &&
        p.options.length === 2 &&
        p.options.includes("Hot") &&
        p.options.includes("Ice")
    );
    expect(hotIceDrinks).toHaveLength(15);
  });

  it("is idempotent when run multiple times", async () => {
    await seed(prisma);
    await seed(prisma);

    const products = await prisma.product.findMany();
    expect(products).toHaveLength(80);
  });
});
