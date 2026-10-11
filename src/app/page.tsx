"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { useBookingDraft } from "@/lib/booking-draft";
import { formatDateIndo } from "@/lib/format";
import { format, parse } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { AlertTriangle, ArrowRight, CalendarDays, Clock, Coffee, Minus, Plus, QrCode, Tv } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Tanggal kalender WIB (UTC+7), bukan zona waktu browser
function toDateInputString(date: Date): string {
  return new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
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
  const [calendarOpen, setCalendarOpen] = useState(false);

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

  // shortcut: jam & durasi mengikuti default Setting, server tetap memvalidasi nilai asli (R-T); ambil dari API kalau admin sering mengubahnya
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
    // Batas atas mengikuti kapasitas ruangan (dicek di langkah 2, R-A2)
    if (guests < 1) {
      setErrorMsg("Jumlah tamu minimal 1 orang.");
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

  // Kalender bekerja dengan Date lokal; string YYYY-MM-DD tetap jadi sumber kebenaran
  const toLocalDate = (s: string) => (s ? parse(s, "yyyy-MM-dd", new Date()) : undefined);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Stepper currentStep={1} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Hero Section */}
        <Card className="p-6 md:p-8 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl">
            <Badge variant="secondary" className="mb-3 bg-primary/10 text-primary">
              Ruang Privat Gratis Tanpa Biaya Sewa
            </Badge>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">
              Reservasi Ruang Pertemuan & Acara Santai
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Nikmati fasilitas ruang privat lengkap di Atmosphere Cafe cukup dengan pre-order menu minimal 1 makanan dan 1 minuman.
            </p>
          </div>
          <div className="bg-muted p-4 rounded-xl border text-center w-full md:w-auto shrink-0">
            <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground font-medium">
              <Clock className="size-3.5" /> Jam Buka
            </span>
            <span className="block text-lg font-bold">10.00 – 22.00</span>
            <span className="block text-[11px] text-brand font-semibold mt-0.5">WIB (Setiap Hari)</span>
          </div>
        </Card>

        {/* Step 1 Booking Form */}
        <Card className="p-6 md:p-8">
          <div className="border-b pb-4 mb-6">
            <h2 className="text-lg font-bold">1. Tentukan Jadwal & Jumlah Tamu</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Pilih tanggal kedatangan, durasi penggunaan ruangan, dan jumlah peserta pertemuan.
            </p>
          </div>

          {errorMsg && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSearchRooms} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Tanggal */}
              <div>
                <Label htmlFor="booking-date" className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-700">
                  Tanggal Reservasi
                </Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="booking-date"
                      type="button"
                      variant="outline"
                      className="w-full h-11 justify-start rounded-xl font-medium"
                    >
                      <CalendarDays className="text-muted-foreground" />
                      {date ? formatDateIndo(date) : "Pilih tanggal"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      locale={localeId}
                      selected={toLocalDate(date)}
                      defaultMonth={toLocalDate(date)}
                      disabled={[
                        ...(minDateStr ? [{ before: toLocalDate(minDateStr)! }] : []),
                        ...(maxDateStr ? [{ after: toLocalDate(maxDateStr)! }] : []),
                      ]}
                      onSelect={(d) => {
                        if (!d) return;
                        setDate(format(d, "yyyy-MM-dd"));
                        setCalendarOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <span className="block text-[11px] text-muted-foreground mt-1.5">
                  Batas pemesanan H-1 hingga 30 hari ke depan
                </span>
              </div>

              {/* Jam Mulai & Selesai */}
              <div>
                <Label className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-700">Jam Reservasi</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Mulai", value: start, onChange: setStart, slots: timeSlots.slice(0, -1) },
                    { label: "Selesai", value: end, onChange: setEnd, slots: timeSlots.slice(1) },
                  ].map((field) => (
                    <div key={field.label}>
                      <select
                        aria-label={`Jam ${field.label}`}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-input bg-white text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {field.slots.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <span className="block text-[10px] text-muted-foreground mt-1 text-center">{field.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Jumlah Tamu */}
              <div>
                <Label className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-700">Jumlah Tamu</Label>
                <div className="flex items-center gap-3 border rounded-xl p-1 bg-white">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-lg"
                    aria-label="Kurangi tamu"
                    onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  >
                    <Minus />
                  </Button>
                  <div className="flex-1 text-center">
                    <span className="text-base font-bold">{guests}</span>
                    <span className="text-xs text-muted-foreground ml-1">orang</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-lg"
                    aria-label="Tambah tamu"
                    onClick={() => setGuests((g) => g + 1)}
                  >
                    <Plus />
                  </Button>
                </div>
                <span className="block text-[11px] text-muted-foreground mt-1.5">
                  Ruangan yang tampil menyesuaikan jumlah tamu
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t flex items-center justify-end">
              <Button type="submit" size="xl" className="w-full md:w-auto">
                Cari Ruangan Tersedia
                <ArrowRight />
              </Button>
            </div>
          </form>
        </Card>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: Coffee,
              title: "Pre-Order Transparan",
              text: "Pilih menu makanan dan minuman favorit Anda langsung dari web tanpa biaya ruangan per jam.",
            },
            {
              icon: Tv,
              title: "Fasilitas Nyaman",
              text: "Dilengkapi AC, Smart TV / Proyektor, stopkontak per meja, dan koneksi internet cepat.",
            },
            {
              icon: QrCode,
              title: "E-Tiket & Kode Booking",
              text: "Dapatkan e-tiket instan dengan kode 4 karakter yang bisa diunduh sebagai gambar dan disimpan ke WhatsApp Anda.",
            },
          ].map((f) => (
            <Card key={f.title} className="p-5 gap-0">
              <f.icon className="size-5 text-brand mb-2" />
              <h3 className="font-bold text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.text}</p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
