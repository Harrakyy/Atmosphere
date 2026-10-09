export function normalizePhone(raw: string): string {
  // R-D2: Hapus semua karakter selain angka
  let cleaned = raw.replace(/\D/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (cleaned.startsWith("8")) {
    cleaned = "628" + cleaned.slice(1);
  }

  // Hasil valid kalau cocok dengan ^628\d{7,12}$
  if (!/^628\d{7,12}$/.test(cleaned)) {
    throw new Error("Nomor WhatsApp tidak valid (harus nomor Indonesia berawalan 08/628)");
  }

  return cleaned;
}
