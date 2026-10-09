import { describe, it, expect } from "vitest";
import { env } from "@/server/env";

describe("Environment Variables Validation (env.ts)", () => {
  it("exports parsed environment variables", () => {
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.APP_URL).toBeDefined();
    expect(env.BETTER_AUTH_SECRET).toBeDefined();
    expect(env.MIDTRANS_SERVER_KEY).toBeDefined();
  });
});
