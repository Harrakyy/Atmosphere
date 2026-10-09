import { PrismaClient, CategoryKind } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { seedAdminUser } from "../src/server/auth";

const prisma = new PrismaClient();

export async function seed(db = prisma) {
  // 1. Setting (id=1)
  await db.setting.upsert({
    where: { id: 1 },
    update: {
      markupBps: 300,
      roundingUnit: 500,
      vaMinTotal: 150000,
      openTime: "10:00",
      closeTime: "22:00",
      slotStepMinutes: 30,
      minDurationMinutes: 60,
      maxDurationMinutes: 240,
      bufferMinutes: 30,
      leadDays: 1,
      leadCutoffTime: "21:00",
      maxAdvanceDays: 30,
      holdMinutes: 17,
      paymentExpiryMinutes: 15,
      cafeWhatsapp: "6281234567890",
    },
    create: {
      id: 1,
      markupBps: 300,
      roundingUnit: 500,
      vaMinTotal: 150000,
      openTime: "10:00",
      closeTime: "22:00",
      slotStepMinutes: 30,
      minDurationMinutes: 60,
      maxDurationMinutes: 240,
      bufferMinutes: 30,
      leadDays: 1,
      leadCutoffTime: "21:00",
      maxAdvanceDays: 30,
      holdMinutes: 17,
      paymentExpiryMinutes: 15,
      cafeWhatsapp: "6281234567890",
    },
  });

  // 2. Ruangan (3 ruangan sesuai §11 overview)
  const rooms = [
    {
      name: "The Loft",
      slug: "the-loft",
      location: "Lantai 2",
      minGuests: 4,
      maxGuests: 10,
      facilities: ["TV", "AC", "Wi-Fi", "Stopkontak"],
      sortOrder: 1,
    },
    {
      name: "The Sunroom",
      slug: "the-sunroom",
      location: "Lantai 1",
      minGuests: 2,
      maxGuests: 6,
      facilities: ["AC", "Wi-Fi", "Stopkontak"],
      sortOrder: 2,
    },
    {
      name: "Event Space",
      slug: "event-space",
      location: "Lantai 2",
      minGuests: 10,
      maxGuests: 30,
      facilities: ["TV", "Mic", "AC", "Wi-Fi", "Stopkontak"],
      sortOrder: 3,
    },
  ];

  for (const r of rooms) {
    await db.room.upsert({
      where: { slug: r.slug },
      update: r,
      create: r,
    });
  }

  // 3. Kategori (4 kategori)
  const categories = [
    { name: "Makanan", kind: CategoryKind.FOOD, sortOrder: 1 },
    { name: "Snack", kind: CategoryKind.FOOD, sortOrder: 2 },
    { name: "Minuman", kind: CategoryKind.DRINK, sortOrder: 3 },
    { name: "Ice Cream", kind: CategoryKind.FOOD, sortOrder: 4 },
  ];

  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    const saved = await db.category.upsert({
      where: { name: c.name },
      update: c,
      create: c,
    });
    categoryMap.set(c.name, saved.id);
  }

  // 4. Produk dari docs/data/menu-awal.csv
  const csvPath = path.resolve(process.cwd(), "docs/data/menu-awal.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // Skip header line
  let sortOrder = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(",");
    const categoryName = parts[0].trim();
    // jenis = parts[1].trim();
    const productName = parts[2].trim();
    const rawOptions = parts[3].trim();
    const basePrice = parseInt(parts[4].trim(), 10);

    const categoryId = categoryMap.get(categoryName);
    if (!categoryId) {
      throw new Error(`Category not found: ${categoryName}`);
    }

    const options = rawOptions ? rawOptions.split("|").map((o) => o.trim()) : [];
    sortOrder++;

    const existing = await db.product.findFirst({
      where: { categoryId, name: productName },
    });

    if (existing) {
      await db.product.update({
        where: { id: existing.id },
        data: {
          basePrice,
          options,
          sortOrder,
          isAvailable: true,
          isArchived: false,
        },
      });
    } else {
      await db.product.create({
        data: {
          categoryId,
          name: productName,
          basePrice,
          options,
          sortOrder,
          isAvailable: true,
          isArchived: false,
        },
      });
    }
  }

  // 5. Admin
  await seedAdminUser(
    process.env.ADMIN_SEED_EMAIL,
    process.env.ADMIN_SEED_PASSWORD,
    db
  );
}

if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seed()
    .then(() => {
      console.log("✅ Database seeded successfully");
      return prisma.$disconnect();
    })
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
