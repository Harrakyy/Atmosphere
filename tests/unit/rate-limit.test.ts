import { describe, it, expect } from "vitest";
import { hitRateLimit } from "@/server/rate-limit";

describe("hitRateLimit", () => {
  const WINDOW = 15 * 60 * 1000;

  it("mengizinkan 10 percobaan, menolak yang ke-11, dan tiap key terpisah", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(hitRateLimit("a", 10, WINDOW, t0).ok).toBe(true);
    }
    const blocked = hitRateLimit("a", 10, WINDOW, t0 + 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(hitRateLimit("b", 10, WINDOW, t0).ok).toBe(true);
  });

  it("jendela baru dimulai setelah waktu habis", () => {
    const t0 = 5_000_000;
    for (let i = 0; i < 11; i++) hitRateLimit("c", 10, WINDOW, t0);
    expect(hitRateLimit("c", 10, WINDOW, t0 + WINDOW + 1).ok).toBe(true);
  });
});
