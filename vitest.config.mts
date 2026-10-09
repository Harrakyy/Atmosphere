import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    passWithNoTests: true,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST || "postgresql://atm:atm@localhost:5433/atmosphere_test",
      PAYMENT_GATEWAY: "fake",
      NODE_ENV: "test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/server/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
