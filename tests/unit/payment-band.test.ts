import { describe, it, expect } from "vitest";
import { ATMOSPHERE_BAND, pickUniqueCode, inBand } from "@/server/payment-band";

describe("Jalur nominal Protokol Setor: Atmosphere 100–499 (K-41)", () => {
  it("total bulat ribuan → tambah Rp100", () => {
    expect(pickUniqueCode(84000, new Set())).toBe(100);
  });

  it("total berakhiran 500 → tambah Rp600 (Rp30.500 → Rp31.100)", () => {
    expect(pickUniqueCode(30500, new Set())).toBe(600);
  });

  it("total yang sudah di jalur (Rp27.250) → tambah sekecil mungkin yang tetap di jalur", () => {
    expect(pickUniqueCode(27250, new Set())).toBe(1); // 27.251
  });

  it("nominal yang sedang dipakai dilewati", () => {
    expect(pickUniqueCode(84000, new Set([84100, 84101]))).toBe(102);
  });

  it("hasil selalu di jalur 100–499 untuk semua kemungkinan 3 digit akhir total", () => {
    for (let last = 0; last < 1000; last++) {
      const total = 50000 + last;
      const k = pickUniqueCode(total, new Set());
      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeLessThanOrEqual(999);
      expect(inBand(total + k)).toBe(true);
    }
  });

  it("melempar error kalau seluruh jalur sedang terpakai", () => {
    const used = new Set(Array.from({ length: 400 }, (_, i) => 84100 + i));
    expect(() => pickUniqueCode(84000, used)).toThrow();
  });

  it("band yang dikirim saat pairing", () => {
    expect(ATMOSPHERE_BAND).toEqual({ min: 100, max: 499 });
  });
});

describe("rentang pilihan Setor", () => {
  it("kode unik menempatkan nominal di rentang yang dipilih", async () => {
    const { pickUniqueCode, inBand, validBand } = await import("@/server/payment-band");
    const band = { min: 200, max: 249 };
    expect(pickUniqueCode(84000, new Set(), band)).toBe(200);
    expect(inBand(84249, band)).toBe(true);
    expect(inBand(84250, band)).toBe(false);
    expect(validBand({ min: 1, max: 3 })).toBe(false);
    expect(validBand({ min: 100, max: 499 })).toBe(true);
  });
});
