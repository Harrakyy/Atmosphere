import { wibDateTime, toWib } from "./time";

export interface TimeRuleSettings {
  openTime?: string;
  closeTime?: string;
  slotStepMinutes?: number;
  minDurationMinutes?: number;
  maxDurationMinutes?: number;
  bufferMinutes?: number;
  leadDays?: number;
  leadCutoffTime?: string;
  maxAdvanceDays?: number;
}

export type ScheduleValidationResult =
  | {
      ok: true;
      startAt: Date;
      endAt: Date;
      blockEndAt: Date;
    }
  | {
      ok: false;
      rule: "R-T1" | "R-T2" | "R-T3" | "R-T4" | "R-T5";
      message: string;
    };

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function validateSchedule(
  input: { date: string; start: string; end: string },
  settings: TimeRuleSettings = {},
  now: Date = new Date()
): ScheduleValidationResult {
  const openTime = settings.openTime ?? "10:00";
  const closeTime = settings.closeTime ?? "22:00";
  const slotStepMinutes = settings.slotStepMinutes ?? 30;
  const minDurationMinutes = settings.minDurationMinutes ?? 60;
  const maxDurationMinutes = settings.maxDurationMinutes ?? 240;
  const bufferMinutes = settings.bufferMinutes ?? 30;
  const leadDays = settings.leadDays ?? 1;
  const leadCutoffTime = settings.leadCutoffTime ?? "21:00";
  const maxAdvanceDays = settings.maxAdvanceDays ?? 30;

  const startMins = timeToMinutes(input.start);
  const endMins = timeToMinutes(input.end);
  const openMins = timeToMinutes(openTime);
  const closeMins = timeToMinutes(closeTime);

  // R-T1: startAt dan endAt berada pada kelipatan slotStepMinutes (30) menit
  if (
    startMins % slotStepMinutes !== 0 ||
    endMins % slotStepMinutes !== 0 ||
    endMins <= startMins
  ) {
    return {
      ok: false,
      rule: "R-T1",
      message: `Jam mulai dan selesai harus kelipatan ${slotStepMinutes} menit.`,
    };
  }

  // R-T2: minDurationMinutes (60) <= durasi <= maxDurationMinutes (240)
  const duration = endMins - startMins;
  if (duration < minDurationMinutes || duration > maxDurationMinutes) {
    return {
      ok: false,
      rule: "R-T2",
      message: `Durasi reservasi minimal ${minDurationMinutes} menit dan maksimal ${maxDurationMinutes} menit.`,
    };
  }

  // R-T3: openTime <= jam mulai, dan jam selesai <= closeTime
  if (startMins < openMins || endMins > closeMins) {
    return {
      ok: false,
      rule: "R-T3",
      message: `Jam operasional cafe adalah ${openTime}–${closeTime} WIB.`,
    };
  }

  // R-T4: Batas paling lambat pesan (H-leadDays pukul leadCutoffTime)
  const [resYear, resMonth, resDay] = input.date.split("-").map(Number);
  const resDateUtc = Date.UTC(resYear, resMonth - 1, resDay);
  const cutoffDateUtc = resDateUtc - leadDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(cutoffDateUtc);
  const cutoffDateStr = `${cutoffDate.getUTCFullYear()}-${String(cutoffDate.getUTCMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getUTCDate()).padStart(2, "0")}`;
  const cutoffDateTime = wibDateTime(cutoffDateStr, leadCutoffTime);

  if (now.getTime() > cutoffDateTime.getTime()) {
    return {
      ok: false,
      rule: "R-T4",
      message: `Batas pemesanan untuk tanggal tersebut adalah H-${leadDays} pukul ${leadCutoffTime} WIB.`,
    };
  }

  // R-T5: Batas paling jauh pesan (hari ini + maxAdvanceDays)
  const nowWib = toWib(now);
  const [todayYear, todayMonth, todayDay] = nowWib.dateStr.split("-").map(Number);
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay);
  const maxAdvanceUtc = todayUtc + maxAdvanceDays * 24 * 60 * 60 * 1000;

  if (resDateUtc > maxAdvanceUtc || resDateUtc < todayUtc) {
    return {
      ok: false,
      rule: "R-T5",
      message: `Pemesanan hanya dapat dilakukan maksimal ${maxAdvanceDays} hari ke depan.`,
    };
  }

  // R-T6: blockEndAt = endAt + bufferMinutes
  const startAt = wibDateTime(input.date, input.start);
  const endAt = wibDateTime(input.date, input.end);
  const blockEndAt = new Date(endAt.getTime() + bufferMinutes * 60 * 1000);

  return {
    ok: true,
    startAt,
    endAt,
    blockEndAt,
  };
}
