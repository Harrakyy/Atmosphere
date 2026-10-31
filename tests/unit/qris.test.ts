import { describe, it, expect } from "vitest";
import { parseQris, toDynamicQris, crc16 } from "@/server/qris";

// QRIS statis DANA (UMI) yang dipakai saat pengembangan
const STATIC =
  "00020101021126570011ID.DANA.WWW011893600915303623183002090362318300303UMI51440014ID.CO.QRIS.WWW0215ID10266209157630303UMI5204581253033605802ID5925Plater squash mas aji, Ma6010Muara Enim61053171163044001";
const DYNAMIC_191999 =
  "00020101021226570011ID.DANA.WWW011893600915303623183002090362318300303UMI51440014ID.CO.QRIS.WWW0215ID10266209157630303UMI52045812530336054061919995802ID5925Plater squash mas aji, Ma6010Muara Enim6105317116304F3D9";

describe("qris.ts R-Q1 parseQris", () => {
  it("membaca nama merchant dan NMID dari QRIS statis yang valid", () => {
    expect(parseQris(STATIC)).toEqual({
      ok: true,
      merchantName: "Plater squash mas aji, Ma",
      merchantCity: "Muara Enim",
      nmid: "ID1026620915763",
    });
  });

  it("menolak CRC yang salah", () => {
    const broken = STATIC.slice(0, -4) + "0000";
    expect(parseQris(broken)).toMatchObject({ ok: false });
  });

  it("menolak QRIS yang sudah dinamis (tag 01 = 12)", () => {
    const r = parseQris(DYNAMIC_191999);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/statis/i);
  });

  it("menolak teks yang bukan QRIS", () => {
    expect(parseQris("https://example.com").ok).toBe(false);
    expect(parseQris("").ok).toBe(false);
    expect(parseQris("0002010102").ok).toBe(false);
  });
});

describe("qris.ts R-Q2 toDynamicQris", () => {
  it("menghasilkan vektor tes Rp191.999 → CRC F3D9", () => {
    expect(toDynamicQris(STATIC, 191999)).toBe(DYNAMIC_191999);
  });

  it("CRC hasil selalu valid dan tag 54 berisi nominal", () => {
    const out = toDynamicQris(STATIC, 15000);
    expect(out).toContain("540515000");
    expect(crc16(out.slice(0, -4))).toBe(out.slice(-4));
  });

  it("menolak nominal yang bukan bilangan bulat positif", () => {
    expect(() => toDynamicQris(STATIC, 0)).toThrow();
    expect(() => toDynamicQris(STATIC, 1.5)).toThrow();
  });
});
