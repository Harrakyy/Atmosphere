"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { useBookingDraft } from "@/lib/booking-draft";
import { formatDateIndo } from "@/lib/format";

interface RoomAvailability {
  id: string;
  name: string;
  location: string | null;
  minGuests: number;
  maxGuests: number;
  facilities: string[];
  photoUrl: string | null;
  available: boolean;
  reason: "CAPACITY_TOO_SMALL" | "BELOW_MIN_GUESTS" | "BOOKED" | "BLOCKED" | null;
}

function getReasonBadge(reason: RoomAvailability["reason"], room: RoomAvailability) {
  switch (reason) {
    case "BOOKED":
      return { text: "Sudah Dipesan", desc: "Ruangan terisi pada jam tersebut." };
    case "BLOCKED":
      return { text: "Sedang Maintenance", desc: "Jadwal ruangan sedang diblokir untuk pemeliharaan." };
    case "CAPACITY_TOO_SMALL":
      return { text: "Kapasitas Terlalu Kecil", desc: `Maksimal hanya ${room.maxGuests} orang.` };
    case "BELOW_MIN_GUESTS":
      return { text: "Kurang dari Min. Tamu", desc: `Minimal ${room.minGuests} orang untuk ruangan ini.` };
    default:
      return { text: "Tidak Tersedia", desc: "Tidak dapat dipesan pada jam ini." };
  }
}

export default function PilihRuanganPage() {
  const router = useRouter();
  const { draft, isLoaded, updateDraft } = useBookingDraft();

  const [rooms, setRooms] = useState<RoomAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!draft.date || !draft.start || !draft.end) {
      router.replace("/");
      return;
    }

    async function fetchRooms() {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({
          date: draft.date,
          start: draft.start,
          end: draft.end,
          guests: String(draft.guests),
        });

        const res = await fetch(`/api/availability?${query.toString()}`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || "Gagal memuat ketersediaan ruangan");
        }

        setRooms(json.data.rooms || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan koneksi");
      } finally {
        setLoading(false);
      }
    }

    fetchRooms();
  }, [isLoaded, draft.date, draft.start, draft.end, draft.guests, router]);

  const handleSelectRoom = (room: RoomAvailability) => {
    if (!room.available) return;

    updateDraft({
      roomId: room.id,
      roomName: room.name,
    });

    router.push("/reservasi/menu");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F2EF]">
      <Header />
      <Stepper currentStep={2} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Selection Summary Pill */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-[#DFDDD6] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Jadwal Pilihan Anda
            </span>
            <span className="text-sm md:text-base font-bold text-[#1C2955]">
              {draft.date ? formatDateIndo(draft.date) : "—"} • {draft.start}–{draft.end} WIB ({draft.guests} Tamu)
            </span>
          </div>

          <Link
            href="/"
            className="text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-[#DFDDD6] text-[#1C2955] hover:bg-[#F3F2EF] transition-all"
          >
            ← Ubah Waktu
          </Link>
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1C2955]">
            2. Pilih Ruangan Pertemuan
          </h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">
            Pilih ruangan privat yang sesuai dengan ukuran rombongan dan kebutuhan acara Anda.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center">
            <div className="inline-block w-8 h-8 border-3 border-[#1C2955]/20 border-t-[#1C2955] rounded-full animate-spin mb-3" />
            <p className="text-xs text-gray-500 font-medium">Memeriksa ketersediaan ruangan...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-white rounded-2xl p-6 border border-rose-200 text-center">
            <p className="text-sm font-semibold text-rose-700 mb-3">⚠️ {error}</p>
            <Link
              href="/"
              className="inline-block px-4 py-2 bg-[#1C2955] text-white text-xs font-bold rounded-lg"
            >
              Kembali ke Pilih Jadwal
            </Link>
          </div>
        )}

        {/* Rooms Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {rooms.map((room) => {
              const reasonBadge = !room.available ? getReasonBadge(room.reason, room) : null;

              return (
                <div
                  key={room.id}
                  className={`bg-white rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs ${
                    room.available
                      ? "border-[#DFDDD6] hover:border-[#1C2955] hover:shadow-md"
                      : "border-gray-200 bg-gray-50/70 opacity-75"
                  }`}
                >
                  <div className="p-5 md:p-6">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h2 className="text-lg font-bold text-[#1C2955]">{room.name}</h2>
                        {room.location && (
                          <span className="text-xs text-gray-500 font-medium">
                            📍 {room.location}
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-semibold px-2.5 py-1 bg-[#F3F2EF] text-[#1C2955] rounded-lg border border-[#DFDDD6] whitespace-nowrap">
                        👥 {room.minGuests}–{room.maxGuests} orang
                      </span>
                    </div>

                    {/* Facilities Chips */}
                    {room.facilities && room.facilities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
                        {room.facilities.map((fac, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md"
                          >
                            ✓ {fac}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Reason Alert for Unavailable Room */}
                    {reasonBadge && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                        <span className="block text-xs font-bold text-amber-800">
                          {reasonBadge.text}
                        </span>
                        <span className="block text-[11px] text-amber-700 mt-0.5">
                          {reasonBadge.desc}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Room Selection Footer */}
                  <div className="p-4 bg-gray-50/80 border-t border-[#DFDDD6] flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] text-gray-400 font-medium">Biaya Sewa</span>
                      <span className="text-xs font-bold text-emerald-700">Gratis (Pre-Order Menu)</span>
                    </div>

                    <button
                      type="button"
                      disabled={!room.available}
                      onClick={() => handleSelectRoom(room)}
                      className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                        room.available
                          ? "bg-[#1C2955] text-white hover:bg-[#1A2751] active:scale-95 shadow-xs"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {room.available ? "Pilih Ruangan Ini →" : "Tidak Tersedia"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
