const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

export interface WibParts {
  date: Date;
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
  hours: number;
  minutes: number;
  seconds: number;
  dateStr: string;
  timeStr: string;
}

export function toWib(date: Date): WibParts {
  const wibTime = new Date(date.getTime() + WIB_OFFSET_MS);
  const year = wibTime.getUTCFullYear();
  const month = wibTime.getUTCMonth() + 1;
  const day = wibTime.getUTCDate();
  const dayOfWeek = wibTime.getUTCDay();
  const hours = wibTime.getUTCHours();
  const minutes = wibTime.getUTCMinutes();
  const seconds = wibTime.getUTCSeconds();

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hours).padStart(2, "0");
  const min = String(minutes).padStart(2, "0");

  return {
    date: wibTime,
    year,
    month,
    day,
    dayOfWeek,
    hours,
    minutes,
    seconds,
    dateStr: `${year}-${mm}-${dd}`,
    timeStr: `${hh}:${min}`,
  };
}

export function wibDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  // UTC timestamp corresponding to WIB time
  const utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - WIB_OFFSET_MS;
  return new Date(utcMs);
}

export function todayWib(now: Date = new Date()): string {
  return toWib(now).dateStr;
}

export function formatJadwal(start: Date, end: Date): string {
  const s = toWib(start);
  const e = toWib(end);

  const dayName = DAYS[s.dayOfWeek];
  const monthName = MONTHS[s.month - 1];

  const startTimeStr = `${String(s.hours).padStart(2, "0")}.${String(s.minutes).padStart(2, "0")}`;
  const endTimeStr = `${String(e.hours).padStart(2, "0")}.${String(e.minutes).padStart(2, "0")}`;

  return `${dayName}, ${s.day} ${monthName} ${s.year}, ${startTimeStr}–${endTimeStr}`;
}
