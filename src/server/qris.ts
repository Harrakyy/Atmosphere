// QRIS = teks EMVCo berformat TLV (tag 2 digit, panjang 2 digit, nilai), ditutup tag 63 berisi CRC16-CCITT.
// Murni tanpa dependensi supaya bisa dipakai di server (validasi) maupun browser (pratinjau admin).

type Tlv = { tag: string; value: string };

export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function parseTlv(payload: string): Tlv[] | null {
  const out: Tlv[] = [];
  for (let i = 0; i < payload.length; ) {
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(payload.slice(i + 2, i + 4))) return null;
    const value = payload.slice(i + 4, i + 4 + len);
    if (value.length !== len) return null;
    out.push({ tag, value });
    i += 4 + len;
  }
  return out;
}

const encode = (tlvs: Tlv[]) =>
  tlvs.map((t) => t.tag + String(t.value.length).padStart(2, "0") + t.value).join("");

export type ParseQrisResult =
  | { ok: true; merchantName: string; merchantCity: string; nmid: string | null }
  | { ok: false; error: string };

// R-Q1: hanya QRIS statis yang valid yang boleh disimpan admin
export function parseQris(payload: string): ParseQrisResult {
  const text = payload.trim();
  const tlvs = parseTlv(text);
  if (!tlvs || tlvs[0]?.tag !== "00" || tlvs.at(-1)?.tag !== "63") {
    return { ok: false, error: "Teks ini bukan QRIS yang valid." };
  }
  if (crc16(text.slice(0, -4)) !== tlvs.at(-1)!.value) {
    return { ok: false, error: "Checksum QRIS tidak cocok. Pastikan gambar QR jelas dan tidak terpotong." };
  }
  const get = (tag: string) => tlvs.find((t) => t.tag === tag)?.value;
  if (get("01") !== "11") {
    return { ok: false, error: "QRIS harus versi statis (yang dicetak di meja kasir), bukan QRIS dinamis/sekali pakai." };
  }
  const merchantName = get("59");
  if (!merchantName) return { ok: false, error: "QRIS tidak memuat nama merchant." };

  // NMID ada di sub-tag 02 dari tag 51 (Merchant Account Information QRIS nasional)
  const t51 = get("51");
  const nmid = (t51 && parseTlv(t51)?.find((t) => t.tag === "02")?.value) || null;

  return { ok: true, merchantName, merchantCity: get("60") ?? "", nmid };
}

// R-Q2: tag 01 → 12, sisipkan tag 54 (nominal), hitung ulang CRC
export function toDynamicQris(staticPayload: string, amount: number): string {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Nominal QRIS harus bilangan bulat positif.");
  }
  const parsed = parseQris(staticPayload);
  if (!parsed.ok) throw new Error(parsed.error);

  const tlvs = parseTlv(staticPayload.trim())!
    .filter((t) => t.tag !== "63" && t.tag !== "54")
    .map((t) => (t.tag === "01" ? { tag: "01", value: "12" } : t));
  tlvs.push({ tag: "54", value: String(amount) });
  tlvs.sort((a, b) => Number(a.tag) - Number(b.tag)); // urutan tag EMVCo harus naik

  const body = encode(tlvs) + "6304";
  return body + crc16(body);
}
