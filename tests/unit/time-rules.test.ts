import { describe, it, expect } from "vitest";
import { validateSchedule } from "@/server/time-rules";
import { wibDateTime } from "@/server/time";

describe("time-rules.ts R-T rules", () => {
  const defaultSettings = {
    openTime: "10:00",
    closeTime: "22:00",
    slotStepMinutes: 30,
    minDurationMinutes: 60,
    maxDurationMinutes: 240,
    bufferMinutes: 30,
    leadDays: 1,
    leadCutoffTime: "21:00",
    maxAdvanceDays: 30,
  };

  it("passes valid schedule and returns startAt, endAt, blockEndAt", () => {
    // Current time: 2026-10-16 10:00 WIB
    const now = wibDateTime("2026-10-16", "10:00");
    const result = validateSchedule(
      { date: "2026-10-18", start: "10:00", end: "12:00" },
      defaultSettings,
      now
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.startAt.toISOString()).toBe("2026-10-18T03:00:00.000Z");
      expect(result.endAt.toISOString()).toBe("2026-10-18T05:00:00.000Z");
      expect(result.blockEndAt.toISOString()).toBe("2026-10-18T05:30:00.000Z");
    }
  });

  it("R-T1: rejects times not on slotStepMinutes multiples", () => {
    const now = wibDateTime("2026-10-16", "10:00");
    const result = validateSchedule(
      { date: "2026-10-18", start: "10:15", end: "12:00" },
      defaultSettings,
      now
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rule).toBe("R-T1");
    }
  });

  it("R-T2: rejects duration less than 60 mins or greater than 240 mins", () => {
    const now = wibDateTime("2026-10-16", "10:00");
    const shortResult = validateSchedule(
      { date: "2026-10-18", start: "10:00", end: "10:30" },
      defaultSettings,
      now
    );
    expect(shortResult.ok).toBe(false);
    if (!shortResult.ok) expect(shortResult.rule).toBe("R-T2");

    const longResult = validateSchedule(
      { date: "2026-10-18", start: "10:00", end: "15:00" }, // 300 mins
      defaultSettings,
      now
    );
    expect(longResult.ok).toBe(false);
    if (!longResult.ok) expect(longResult.rule).toBe("R-T2");
  });

  it("R-T3: rejects schedule outside operational hours (10:00 - 22:00)", () => {
    const now = wibDateTime("2026-10-16", "10:00");
    const early = validateSchedule(
      { date: "2026-10-18", start: "09:00", end: "11:00" },
      defaultSettings,
      now
    );
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.rule).toBe("R-T3");

    const late = validateSchedule(
      { date: "2026-10-18", start: "21:00", end: "22:30" },
      defaultSettings,
      now
    );
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.rule).toBe("R-T3");
  });

  it("R-T4: lead cutoff: H-1 21:00 is allowed, 21:01 is rejected", () => {
    // For date 2026-10-18, H-1 is 2026-10-17
    const cutoffAt2100 = wibDateTime("2026-10-17", "21:00");
    const okResult = validateSchedule(
      { date: "2026-10-18", start: "10:00", end: "12:00" },
      defaultSettings,
      cutoffAt2100
    );
    expect(okResult.ok).toBe(true);

    // 1 minute later
    const pastCutoff = new Date(cutoffAt2100.getTime() + 60 * 1000);
    const rejectedResult = validateSchedule(
      { date: "2026-10-18", start: "10:00", end: "12:00" },
      defaultSettings,
      pastCutoff
    );
    expect(rejectedResult.ok).toBe(false);
    if (!rejectedResult.ok) expect(rejectedResult.rule).toBe("R-T4");
  });

  it("R-T5: rejects reservations beyond maxAdvanceDays", () => {
    // Current date: 2026-10-10
    const now = wibDateTime("2026-10-10", "10:00");
    // 31 days ahead: 2026-11-10
    const tooFar = validateSchedule(
      { date: "2026-11-10", start: "10:00", end: "12:00" },
      defaultSettings,
      now
    );
    expect(tooFar.ok).toBe(false);
    if (!tooFar.ok) expect(tooFar.rule).toBe("R-T5");
  });
});
