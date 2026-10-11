import { PrismaClient, CategoryKind } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { seedAdminUser } from "../src/server/auth";

const prisma = new PrismaClient();

export async function seed(db = prisma) {
  // 1. Setting (id=1): nilai default dari skema. Upsert kosong supaya seed ulang tidak menimpa pengaturan admin
  await db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  // 2. Ruangan: foto asli dari cafe di public/ruangan. Kapasitas & fasilitas masih asumsi (§11), bisa diubah admin
  const rooms = [
    { name: "Ruangan 1", slug: "ruangan-1", minGuests: 4, maxGuests: 10, facilities: ["TV", "AC", "Wi-Fi", "Stopkontak"] },
    { name: "Ruangan 2", slug: "ruangan-2", minGuests: 2, maxGuests: 6, facilities: ["AC", "Wi-Fi", "Stopkontak"] },
    { name: "Ruangan 3", slug: "ruangan-3", minGuests: 10, maxGuests: 30, facilities: ["TV", "Mic", "AC", "Wi-Fi", "Stopkontak"] },
    { name: "Ruangan 4", slug: "ruangan-4", minGuests: 4, maxGuests: 12, facilities: ["AC", "Wi-Fi", "Stopkontak"] },
  ].map((r, i) => ({ ...r, photoUrl: `/ruangan/${i + 1}.jpeg`, sortOrder: i + 1 }));

  for (const r of rooms) {
    await db.room.upsert({
      where: { slug: r.slug },
      update: {},
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
      update: {},
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
    // Foto ilustrasi Unsplash (hotlink sesuai pedoman API); atribusi di docs/data/sumber-foto.csv
    const photoUrl = parts[6]?.trim() || null;

    const categoryId = categoryMap.get(categoryName);
    if (!categoryId) {
      throw new Error(`Category not found: ${categoryName}`);
    }

    const options = rawOptions ? rawOptions.split("|").map((o) => o.trim()) : [];
    sortOrder++;

    const existing = await db.product.findFirst({
      where: { categoryId, name: productName },
    });

    // Produk yang sudah ada tidak disentuh (harga/status admin tidak ter-reset), kecuali foto yang masih kosong
    if (!existing) {
      await db.product.create({
        data: {
          categoryId,
          name: productName,
          basePrice,
          options,
          photoUrl,
          sortOrder,
          isAvailable: true,
          isArchived: false,
        },
      });
    } else if (!existing.photoUrl && photoUrl) {
      await db.product.update({ where: { id: existing.id }, data: { photoUrl } });
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
