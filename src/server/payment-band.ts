// Protokol Setor §3: satu DANA dipakai beberapa usaha, jadi tiap usaha punya jalur 3 digit terakhir nominal bayar.
// Atmosphere 100–499 (tab.booth 001–099, Kosinyuk 500–999). Setor hanya mengirim nominal di jalur ini.
// Bawaan; pemilik bisa menggantinya dari app Setor (disimpan di Setting.bandMin/bandMax)
export const ATMOSPHERE_BAND = { min: 100, max: 499 } as const;
export type Band = { min: number; max: number };

export const inBand = (amount: number, band: Band = ATMOSPHERE_BAND) => {
  const last = amount % 1000;
  return last >= band.min && last <= band.max;
};

/** Rentang dari Setor: bilangan bulat 1–999, min ≤ max, minimal 10 angka. */
export const validBand = (b: unknown): b is Band => {
  const x = b as Band;
  return Number.isInteger(x?.min) && Number.isInteger(x?.max) && x.min >= 1 && x.max <= 999 && x.max - x.min >= 9;
};

/**
 * K-41: kode unik DITAMBAHKAN ke total. Pilih k terkecil (1–999) supaya total + k jatuh di jalur
 * dan belum dipakai pesanan lain. Contoh: Rp84.000 → +100 (Rp84.100), Rp30.500 → +600 (Rp31.100).
 */
export function pickUniqueCode(total: number, usedPayAmounts: Set<number>, band: Band = ATMOSPHERE_BAND): number {
  for (let k = 1; k <= 999; k++) {
    const pay = total + k;
    if (inBand(pay, band) && !usedPayAmounts.has(pay)) return k;
  }
  throw new Error("Semua nominal di jalur sedang terpakai");
}
