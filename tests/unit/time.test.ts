import { describe, it, expect } from "vitest";
import { wibDateTime, toWib, formatJadwal, todayWib } from "@/server/time";

describe("time.ts WIB helpers", () => {
  it("wibDateTime parses date and time in WIB (+07:00)", () => {
    const d = wibDateTime("2026-10-18", "10:00");
    expect(d.toISOString()).toBe("2026-10-18T03:00:00.000Z");
  });

  it("toWib extracts date string and time parts in WIB", () => {
    const d = new Date("2026-10-18T03:00:00.000Z");
    const wib = toWib(d);
    expect(wib.dateStr).toBe("2026-10-18");
    expect(wib.timeStr).toBe("10:00");
    expect(wib.hours).toBe(10);
    expect(wib.minutes).toBe(0);
  });

  it("todayWib gets current date in WIB", () => {
    // 2026-10-17 18:00 UTC = 2026-10-18 01:00 WIB
    const now = new Date("2026-10-17T18:00:00.000Z");
    expect(todayWib(now)).toBe("2026-10-18");
  });

  it("formatJadwal formats start and end in Indonesian WIB format", () => {
    const start = new Date("2026-10-18T03:00:00.000Z"); // 10:00 WIB, Minggu/Sabtu
    const end = new Date("2026-10-18T05:00:00.000Z"); // 12:00 WIB
    // 2026-10-18 is Sunday (Min)
    expect(formatJadwal(start, end)).toBe("Min, 18 Okt 2026, 10.00–12.00");

    // 2026-10-17 is Saturday (Sab)
    const startSab = new Date("2026-10-17T03:00:00.000Z");
    const endSab = new Date("2026-10-17T05:00:00.000Z");
    expect(formatJadwal(startSab, endSab)).toBe("Sab, 17 Okt 2026, 10.00–12.00");
  });
});
