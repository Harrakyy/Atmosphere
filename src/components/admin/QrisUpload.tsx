"use client";

import { useState } from "react";
import jsQR from "jsqr";
import { CheckCircle2, QrCode, Upload } from "lucide-react";
import { parseQris } from "@/server/qris";

// jsQR bisa gagal di satu skala tapi berhasil di skala lain (foto QRIS asli meleset tepat di 1200px),
// jadi coba beberapa ukuran berurutan. Server tetap memvalidasi ulang saat disimpan (R-Q1).
const DECODE_SIZES = [2000, 1000, 800, 600, 1400];

async function decodeQrImage(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  for (const max of DECODE_SIZES) {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const text = jsQR(data, width, height)?.data;
    if (text) return text;
  }
  return null;
}

export function QrisUpload({ value, onChange }: { value: string; onChange: (payload: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const current = value ? parseQris(value) : null;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const text = await decodeQrImage(file);
      if (!text) throw new Error("QR tidak terbaca. Gunakan foto/screenshot yang jelas dan tidak terpotong.");
      const parsed = parseQris(text);
      if (!parsed.ok) throw new Error(parsed.error);
      onChange(text);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal membaca gambar QRIS.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {current?.ok ? (
        <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900">
          <CheckCircle2 className="size-5 shrink-0" />
          <div>
            <p className="font-bold">{current.merchantName}</p>
            <p className="text-[11px]">
              {current.merchantCity} {current.nmid && <>· NMID {current.nmid}</>}
            </p>
            <p className="text-[10px] text-emerald-700 mt-1">
              Pastikan ini merchant milik cafe. Semua pembayaran customer masuk ke merchant ini.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900">
          <QrCode className="size-4" />
          QRIS belum diatur. Customer belum bisa membuat pesanan.
        </div>
      )}

      <label className="inline-flex w-fit items-center gap-2 px-4 py-2.5 rounded-xl border border-[#DFDDD6] font-bold cursor-pointer hover:bg-gray-50 focus-within:ring-2 focus-within:ring-[#1C2955]">
        <Upload className="size-4" />
        {current?.ok ? "Ganti gambar QRIS" : "Upload gambar QRIS statis"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <span className="text-[10px] text-gray-400">
        Pakai QRIS statis yang dicetak untuk meja kasir. Perubahan baru berlaku setelah menekan Simpan Pengaturan.
      </span>
    </div>
  );
}
