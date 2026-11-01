// Protokol Setor §3: satu DANA dipakai beberapa usaha, jadi tiap usaha punya jalur 3 digit terakhir nominal bayar.
// Atmosphere 100–499 (tab.booth 001–099, Kosinyuk 500–999). Setor hanya mengirim nominal di jalur ini.
export const ATMOSPHERE_BAND = { min: 100, max: 499 } as const;

export const inBand = (amount: number) => {
  const last = amount % 1000;
  return last >= ATMOSPHERE_BAND.min && last <= ATMOSPHERE_BAND.max;
};

/**
 * K-41: kode unik DITAMBAHKAN ke total. Pilih k terkecil (1–999) supaya total + k jatuh di jalur
 * dan belum dipakai pesanan lain. Contoh: Rp84.000 → +100 (Rp84.100), Rp30.500 → +600 (Rp31.100).
 */
export function pickUniqueCode(total: number, usedPayAmounts: Set<number>): number {
  for (let k = 1; k <= 999; k++) {
    const pay = total + k;
    if (inBand(pay) && !usedPayAmounts.has(pay)) return k;
  }
  throw new Error("Semua nominal di jalur sedang terpakai");
}
