import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "./db";
import { env } from "./env";
import { UnauthorizedError } from "./http";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
});

export async function requireAdmin(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session || !session.user) {
    throw new UnauthorizedError("Akses ditolak. Sesi admin tidak valid atau telah berakhir.");
  }

  return session;
}

export async function seedAdminUser(
  email = process.env.ADMIN_SEED_EMAIL,
  password = process.env.ADMIN_SEED_PASSWORD,
  db = prisma
) {
  if (!email || !password) return null;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;

  const hashedPassword = await hashPassword(password);
  const user = await db.user.create({
    data: {
      name: "Admin Atmosphere",
      email,
      emailVerified: true,
    },
  });

  await db.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: hashedPassword,
    },
  });

  return user;
}
