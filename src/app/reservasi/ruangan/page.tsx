"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock, Info, MapPin, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookingDraft } from "@/lib/booking-draft";
import { formatDateIndo, formatTimeRange } from "@/lib/format";

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

interface BusySlot {
  startAt: string;
  endAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Blokir sehari penuh dipotong server ke 00.00–00.00, jadi ditampilkan sebagai "Seharian"
function formatBusySlot(slot: BusySlot): string {
  return Date.parse(slot.endAt) - Date.parse(slot.startAt) >= DAY_MS
    ? "Seharian"
    : formatTimeRange(slot.startAt, slot.endAt).replace(" WIB", "");
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
  const [busyByRoom, setBusyByRoom] = useState<Record<string, readonly BusySlot[]>>({});

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

        const fetchedRooms: RoomAvailability[] = json.data.rooms || [];
        setRooms(fetchedRooms);

        // Jam terisi per ruangan hanya info tambahan: kalau gagal, kartu tetap tampil tanpa daftar ini
        const busyEntries = await Promise.all(
          fetchedRooms.map(async (room) => {
            try {
              const busyRes = await fetch(
                `/api/availability/day?${new URLSearchParams({ roomId: room.id, date: draft.date })}`
              );
              const busyJson = await busyRes.json();
              const busy: BusySlot[] = busyJson.success ? busyJson.data.busy : [];
              return [room.id, [...busy].sort((a, b) => a.startAt.localeCompare(b.startAt))] as const;
            } catch {
              return [room.id, []] as const;
            }
          })
        );
        setBusyByRoom(Object.fromEntries(busyEntries));
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
    <div className="min-h-screen flex flex-col">
      <Header />
      <Stepper currentStep={2} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Selection Summary Pill */}
        <Card className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Jadwal Pilihan Anda
            </span>
            <span className="text-sm md:text-base font-bold">
              {draft.date ? formatDateIndo(draft.date) : "—"} • {draft.start}–{draft.end} WIB ({draft.guests} Tamu)
            </span>
          </div>

          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <ArrowLeft />
              Ubah Waktu
            </Link>
          </Button>
        </Card>

        {/* Heading */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold">2. Pilih Ruangan Pertemuan</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Pilih ruangan privat yang sesuai dengan ukuran rombongan dan kebutuhan acara Anda.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5" aria-label="Memeriksa ketersediaan ruangan">
            {[0, 1].map((i) => (
              <Card key={i} className="overflow-hidden p-0 gap-0">
                <Skeleton className="h-44 w-full rounded-none" />
                <div className="p-5 flex flex-col gap-3">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <Alert variant="destructive" className="bg-white">
            <AlertTriangle />
            <AlertTitle>{error}</AlertTitle>
            <AlertDescription>
              <Button asChild size="sm" className="mt-2">
                <Link href="/">Kembali ke Pilih Jadwal</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Rooms Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {rooms.map((room) => {
              const reasonBadge = !room.available ? getReasonBadge(room.reason, room) : null;

              return (
                <Card
                  key={room.id}
                  className={`overflow-hidden p-0 gap-0 justify-between transition-all ${
                    room.available ? "hover:border-primary hover:shadow-md" : "opacity-75"
                  }`}
                >
                  {room.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={room.photoUrl}
                      alt={`Foto ${room.name}`}
                      loading="lazy"
                      className={`w-full h-44 object-cover bg-muted ${room.available ? "" : "grayscale"}`}
                    />
                  )}
                  <div className="p-5 md:p-6 flex-1">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h2 className="text-lg font-bold">{room.name}</h2>
                        {room.location && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                            <MapPin className="size-3" /> {room.location}
                          </span>
                        )}
                      </div>

                      <Badge variant="outline" className="whitespace-nowrap">
                        <Users /> {room.minGuests}–{room.maxGuests} orang
                      </Badge>
                    </div>

                    {/* Facilities Chips */}
                    {room.facilities && room.facilities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
                        {room.facilities.map((fac) => (
                          <Badge key={fac} variant="secondary" className="font-medium text-muted-foreground">
                            <Check /> {fac}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Jam terisi di tanggal ini (sudah termasuk jeda 30 menit dan blokir) */}
                    {busyByRoom[room.id] && (
                      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground mb-3">
                        <Clock className="size-3.5 shrink-0 mt-px" />
                        <span>
                          <span className="font-bold text-foreground">
                            Terisi {draft.date ? formatDateIndo(draft.date) : ""}:{" "}
                          </span>
                          {busyByRoom[room.id].length > 0
                            ? `${busyByRoom[room.id].map(formatBusySlot).join(", ")} WIB`
                            : "Belum ada, semua jam masih kosong"}
                        </span>
                      </p>
                    )}

                    {/* Reason Alert for Unavailable Room */}
                    {reasonBadge && (
                      <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                        <Info />
                        <AlertTitle>{reasonBadge.text}</AlertTitle>
                        <AlertDescription className="text-amber-700">{reasonBadge.desc}</AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Room Selection Footer */}
                  <div className="p-4 bg-muted/60 border-t flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] text-muted-foreground font-medium">Biaya Sewa</span>
                      <span className="text-xs font-bold text-emerald-700">Gratis (Pre-Order Menu)</span>
                    </div>

                    <Button
                      type="button"
                      size="lg"
                      disabled={!room.available}
                      onClick={() => handleSelectRoom(room)}
                    >
                      {room.available ? (
                        <>
                          Pilih Ruangan Ini <ArrowRight />
                        </>
                      ) : (
                        "Tidak Tersedia"
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
