import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_URL_TEST: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  MIDTRANS_SERVER_KEY: z.string().min(1, "MIDTRANS_SERVER_KEY is required"),
  NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: z.string().min(1, "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY is required"),
  MIDTRANS_IS_PRODUCTION: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  PAYMENT_GATEWAY: z.enum(["midtrans", "fake"]).default("midtrans"),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  ADMIN_SEED_EMAIL: z.string().email().optional(),
  ADMIN_SEED_PASSWORD: z.string().min(8).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
