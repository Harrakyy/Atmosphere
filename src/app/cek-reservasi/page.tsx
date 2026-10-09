"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";

export default function CekReservasiPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/tickets/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          phone: phone.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          json.error?.message ||
            "Reservasi tidak ditemukan. Pastikan kode booking dan nomor WhatsApp sudah sesuai."
        );
      }

      router.push(`/tiket/${json.data.ticketToken}`);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Terjadi kesalahan saat mencari tiket."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F2EF]">
      <Header />

      <main className="flex-1 max-w-md w-full mx-auto p-4 md:py-12 flex flex-col justify-center gap-6">
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#DFDDD6] shadow-sm">
          <div className="text-center mb-6">
            <span className="text-2xl mb-2 block">🔍</span>
            <h1 className="text-xl font-bold text-[#1C2955]">
              Cari & Cek E-Tiket Reservasi
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Masukkan kode reservasi dan nomor WhatsApp yang digunakan saat pemesanan.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="lookup-code" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Kode Booking
              </label>
              <input
                id="lookup-code"
                type="text"
                required
                placeholder="Contoh: ATM-7K2F9Q"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFDDD6] focus:border-[#1C2955] outline-none text-sm font-mono font-bold text-[#1C2955] bg-white"
              />
            </div>

            <div>
              <label htmlFor="lookup-phone" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Nomor WhatsApp
              </label>
              <input
                id="lookup-phone"
                type="tel"
                required
                placeholder="Contoh: 081234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFDDD6] focus:border-[#1C2955] outline-none text-sm text-[#1C2955] bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3 bg-[#1C2955] hover:bg-[#1A2751] text-white font-bold text-sm rounded-xl shadow-xs transition-all active:scale-98"
            >
              {loading ? "Mencari..." : "Buka E-Tiket →"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <Link href="/" className="text-xs text-gray-500 hover:text-[#1C2955] font-medium">
              ← Kembali ke Beranda
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
