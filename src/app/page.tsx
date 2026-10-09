"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { useBookingDraft } from "@/lib/booking-draft";

function toDateInputString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function HomePage() {
  const router = useRouter();
  const { draft, isLoaded, updateDraft } = useBookingDraft();

  const [minDateStr, setMinDateStr] = useState("");
  const [maxDateStr, setMaxDateStr] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("12:00");
  const [guests, setGuests] = useState(4);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const minDateObj = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const maxDateObj = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const minStr = toDateInputString(minDateObj);
    const maxStr = toDateInputString(maxDateObj);
    setMinDateStr(minStr);
    setMaxDateStr(maxStr);

    if (isLoaded) {
      if (draft.date && draft.date >= minStr && draft.date <= maxStr) {
        setDate(draft.date);
      } else {
        setDate(minStr);
      }
      if (draft.start) setStart(draft.start);
      if (draft.end) setEnd(draft.end);
      if (draft.guests) setGuests(draft.guests);
    } else {
      setDate(minStr);
    }
  }, [isLoaded, draft.date, draft.start, draft.end, draft.guests]);

  // Jam operasional: 10:00 - 22:00 kelipatan 30 menit
  const timeSlots = [
    "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30",
    "20:00", "20:30", "21:00", "21:30", "22:00"
  ];

  const handleSearchRooms = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    const duration = endMins - startMins;

    if (duration <= 0) {
      setErrorMsg("Jam selesai harus setelah jam mulai.");
      return;
    }
    if (duration < 60) {
      setErrorMsg("Durasi reservasi minimal 1 jam (60 menit).");
      return;
    }
    if (duration > 240) {
      setErrorMsg("Durasi reservasi maksimal 4 jam (240 menit).");
      return;
    }
    if (guests < 1 || guests > 30) {
      setErrorMsg("Jumlah tamu harus antara 1 dan 30 orang.");
      return;
    }

    // Simpan ke draft & lanjut ke pemilihan ruangan
    updateDraft({
      date,
      start,
      end,
      guests,
    });

    router.push("/reservasi/ruangan");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F2EF]">
      <Header />
      <Stepper currentStep={1} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Hero Section */}
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-[#DFDDD6] shadow-xs text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="inline-block px-3 py-1 bg-[#1C2955]/10 text-[#1C2955] text-xs font-semibold rounded-full mb-3">
              Ruang Privat Gratis Tanpa Biaya Sewa
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#1C2955] tracking-tight mb-2">
              Reservasi Ruang Pertemuan & Acara Santai
            </h1>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              Nikmati fasilitas ruang privat lengkap di Atmosphere Cafe cukup dengan pre-order menu minimal 1 makanan dan 1 minuman.
            </p>
          </div>
          <div className="bg-[#F3F2EF] p-4 rounded-xl border border-[#DFDDD6] text-center w-full md:w-auto shrink-0">
            <span className="block text-xs text-gray-500 font-medium">Jam Buka</span>
            <span className="block text-lg font-bold text-[#1C2955]">10.00 – 22.00</span>
            <span className="block text-[11px] text-[#D81B60] font-semibold mt-0.5">WIB (Setiap Hari)</span>
          </div>
        </div>

        {/* Step 1 Booking Form */}
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-[#DFDDD6] shadow-sm">
          <div className="border-b border-[#DFDDD6] pb-4 mb-6">
            <h2 className="text-lg font-bold text-[#1C2955]">1. Tentukan Jadwal & Jumlah Tamu</h2>
            <p className="text-xs text-gray-500 mt-1">
              Pilih tanggal kedatangan, durasi penggunaan ruangan, dan jumlah peserta pertemuan.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleSearchRooms} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Tanggal */}
              <div>
                <label htmlFor="booking-date" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Tanggal Reservasi
                </label>
                <input
                  id="booking-date"
                  type="date"
                  min={minDateStr}
                  max={maxDateStr}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFDDD6] focus:border-[#1C2955] focus:ring-2 focus:ring-[#1C2955]/15 outline-none font-medium text-sm text-[#1C2955] bg-white transition-all"
                />
                <span className="block text-[11px] text-gray-500 mt-1.5">
                  Batas pemesanan H-1 hingga 30 hari ke depan
                </span>
              </div>

              {/* Jam Mulai & Selesai */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Jam Reservasi
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <select
                      aria-label="Jam Mulai"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#DFDDD6] focus:border-[#1C2955] outline-none text-sm text-[#1C2955] font-medium bg-white"
                    >
                      {timeSlots.slice(0, -1).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <span className="block text-[10px] text-gray-400 mt-1 text-center">Mulai</span>
                  </div>
                  <div>
                    <select
                      aria-label="Jam Selesai"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#DFDDD6] focus:border-[#1C2955] outline-none text-sm text-[#1C2955] font-medium bg-white"
                    >
                      {timeSlots.slice(1).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <span className="block text-[10px] text-gray-400 mt-1 text-center">Selesai</span>
                  </div>
                </div>
              </div>

              {/* Jumlah Tamu */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Jumlah Tamu
                </label>
                <div className="flex items-center gap-3 border border-[#DFDDD6] rounded-xl p-1 bg-white">
                  <button
                    type="button"
                    onClick={() => setGuests((g) => Math.max(1, g - 1))}
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg bg-[#F3F2EF] text-[#1C2955] hover:bg-gray-200 active:scale-95 transition-all"
                  >
                    -
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-base font-bold text-[#1C2955]">{guests}</span>
                    <span className="text-xs text-gray-500 ml-1">orang</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGuests((g) => Math.min(30, g + 1))}
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg bg-[#F3F2EF] text-[#1C2955] hover:bg-gray-200 active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>
                <span className="block text-[11px] text-gray-500 mt-1.5">
                  Kapasitas ruangan 2 hingga 20 orang
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-[#DFDDD6] flex items-center justify-end">
              <button
                type="submit"
                className="w-full md:w-auto px-8 py-3 bg-[#1C2955] hover:bg-[#1A2751] text-white font-bold text-sm rounded-xl shadow-sm hover:shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                Cari Ruangan Tersedia →
              </button>
            </div>
          </form>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#DFDDD6] shadow-xs">
            <span className="text-xl mb-2 block">☕</span>
            <h3 className="font-bold text-sm text-[#1C2955] mb-1">Pre-Order Transparan</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Pilih menu makanan dan minuman favorit Anda langsung dari web tanpa biaya ruangan per jam.
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-[#DFDDD6] shadow-xs">
            <span className="text-xl mb-2 block">📺</span>
            <h3 className="font-bold text-sm text-[#1C2955] mb-1">Fasilitas Nyaman</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Dilengkapi AC, Smart TV / Proyektor, stopkontak per meja, dan koneksi internet cepat.
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-[#DFDDD6] shadow-xs">
            <span className="text-xl mb-2 block">📱</span>
            <h3 className="font-bold text-sm text-[#1C2955] mb-1">E-Tiket & QR Check-in</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Dapatkan e-tiket instan dengan kode QR yang bisa disimpan langsung ke chat WhatsApp Anda.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
