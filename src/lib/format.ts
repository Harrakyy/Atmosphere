export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

const DAYS_INDO = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

const MONTHS_INDO = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function formatDateIndo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);

  // Offset 7 jam untuk WIB
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000));

  const dayName = DAYS_INDO[wib.getDay()];
  const day = wib.getDate();
  const monthName = MONTHS_INDO[wib.getMonth()];
  const year = wib.getFullYear();

  return `${dayName}, ${day} ${monthName} ${year}`;
}

export function formatTimeRange(start: string | Date, end: string | Date): string {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;

  const sWib = new Date(s.getTime() + (s.getTimezoneOffset() * 60000) + 7 * 3600000);
  const eWib = new Date(e.getTime() + (e.getTimezoneOffset() * 60000) + 7 * 3600000);

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(sWib.getHours())}.${pad(sWib.getMinutes())}–${pad(eWib.getHours())}.${pad(eWib.getMinutes())} WIB`;
}

export function getStatusInfo(status: string): { label: string; bg: string; text: string } {
  switch (status) {
    case "PENDING_PAYMENT":
      return { label: "Menunggu Pembayaran", bg: "bg-amber-100", text: "text-amber-800" };
    case "CONFIRMED":
      return { label: "Terkonfirmasi", bg: "bg-emerald-100", text: "text-emerald-800" };
    case "CHECKED_IN":
      return { label: "Sedang Berlangsung", bg: "bg-blue-100", text: "text-blue-800" };
    case "COMPLETED":
      return { label: "Selesai", bg: "bg-gray-100", text: "text-gray-800" };
    case "CANCELLED":
      return { label: "Dibatalkan", bg: "bg-rose-100", text: "text-rose-800" };
    case "EXPIRED":
      return { label: "Kedaluwarsa", bg: "bg-stone-200", text: "text-stone-700" };
    case "NO_SHOW":
      return { label: "Tidak Hadir", bg: "bg-purple-100", text: "text-purple-800" };
    default:
      return { label: status, bg: "bg-gray-100", text: "text-gray-700" };
  }
}
