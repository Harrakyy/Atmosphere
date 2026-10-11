import { PrismaClient } from "@prisma/client";
import "./env"; // validasi env saat start (§10): gagal cepat kalau ada yang kosong

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
