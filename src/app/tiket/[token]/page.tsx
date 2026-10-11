"use client";

import { useEffect, useState, useRef, use, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { formatRupiah, formatDateIndo, formatTimeRange, getStatusInfo } from "@/lib/format";
import { downloadCodeCard } from "@/lib/code-card";
import { formatJadwal } from "@/server/time";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, CreditCard, Download, Loader2, MessageCircle, Phone, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface TicketData {
  code: string;
  status: string;
  room: {
    id: string;
    name: string;
    location: string | null;
  };
  startAt: string;
  endAt: string;
  guestCount: number;
  customerName: string;
  items: {
    id: string;
    productId: string;
    productName: string;
    option: string | null;
    kind: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  totalAmount: number;
  servingTime: string;
  servingAt: string | null;
  kitchenNote: string | null;
  holdExpiresAt: string;
  snapToken: string | null;
  snapRedirectUrl: string | null;
  wa: {
    saveLink: string;
    contactCafeLink: string;
  };
}

export default function TiketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pollCountRef = useRef(0);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${token}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Tiket tidak ditemukan.");
      }

      setTicket(json.data);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat tiket.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // Polling jika status masih PENDING_PAYMENT (cek setiap 3 detik, max 2 menit = 40x)
  useEffect(() => {
    if (!ticket || ticket.status !== "PENDING_PAYMENT") return;

    const interval = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current > 40) {
        clearInterval(interval);
        return;
      }

      try {
        const res = await fetch(`/api/tickets/${token}`);
        const json = await res.json();
        if (json.success && json.data.status !== "PENDING_PAYMENT") {
          setTicket(json.data);
          clearInterval(interval);
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [ticket, token]);

  // Kode hanya berguna ke kasir kalau reservasi sudah lunas dan belum selesai
  const canCheckIn = ticket?.status === "CONFIRMED" || ticket?.status === "CHECKED_IN";

  const handleCopyCode = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(ticket.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = async () => {
    if (!ticket) return;
    try {
      await downloadCodeCard({
        code: ticket.code,
        roomName: ticket.room.name,
        jadwal: formatJadwal(new Date(ticket.startAt), new Date(ticket.endAt)),
        customerName: ticket.customerName,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh kode.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Stepper currentStep={5} />

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {loading && (
          <Card className="p-8 items-center gap-4" aria-label="Memuat e-tiket reservasi">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="size-48 rounded-2xl" />
          </Card>
        )}

        {!loading && error && (
          <Alert variant="destructive" className="bg-white p-6">
            <AlertTriangle />
            <AlertTitle>{error}</AlertTitle>
            <AlertDescription>
              Pastikan link e-tiket yang Anda buka sudah benar atau cek kembali di halaman pencarian tiket.
              <Button asChild size="sm" className="mt-3">
                <Link href="/cek-reservasi">
                  <Search /> Cari Reservasi
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!loading && ticket && (
          <div className="flex flex-col gap-5">
            {/* Ticket Header & Status Card */}
            <Card className="rounded-3xl p-6 md:p-8 items-center text-center gap-0 shadow-sm">
              {/* Status Banner */}
              {(() => {
                const s = getStatusInfo(ticket.status);
                return (
                  <Badge className={`px-4 py-1.5 h-auto text-xs uppercase tracking-wider mb-4 ${s.bg} ${s.text}`}>
                    {s.label}
                  </Badge>
                );
              })()}

              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{ticket.room.name}</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                {formatDateIndo(ticket.startAt)} • {formatTimeRange(ticket.startAt, ticket.endAt)}
              </p>

              {/* Booking Code with Copy */}
              <div className="mt-5 flex flex-col items-center gap-2 bg-muted px-8 py-5 rounded-2xl border w-full max-w-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Kode Reservasi
                </span>
                <span
                  className="font-mono font-extrabold text-5xl tracking-[0.3em] pl-[0.3em] text-brand"
                  aria-label={`Kode reservasi ${ticket.code.split("").join(" ")}`}
                >
                  {ticket.code}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={handleCopyCode}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Tersalin" : "Salin"}
                </Button>
                {canCheckIn && (
                  <span className="text-[11px] text-muted-foreground">
                    Tunjukkan kode ini ke kasir saat tiba di cafe
                  </span>
                )}
              </div>

              {/* Status Pending Payment notice */}
              {ticket.status === "PENDING_PAYMENT" && (
                <Alert className="mt-5 max-w-md border-amber-200 bg-amber-50 text-amber-800 text-left" aria-live="polite">
                  <Loader2 className="animate-spin" />
                  <AlertTitle>Menunggu konfirmasi pembayaran...</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    Halaman ini akan otomatis terbarui saat pembayaran berhasil diverifikasi.
                    {ticket.snapRedirectUrl && (
                      <Button asChild size="sm" className="mt-2">
                        <a href={ticket.snapRedirectUrl} target="_blank" rel="noopener noreferrer">
                          <CreditCard /> Buka Pembayaran
                        </a>
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons: WA & Unduh Kode */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 w-full">
                <Button asChild size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <a href={ticket.wa.saveLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> Simpan ke WhatsApp
                  </a>
                </Button>

                {canCheckIn && (
                  <Button type="button" variant="outline" size="lg" onClick={handleDownloadCode}>
                    <Download /> Unduh Kode (PNG)
                  </Button>
                )}

                <Button asChild variant="outline" size="lg">
                  <a href={ticket.wa.contactCafeLink} target="_blank" rel="noopener noreferrer">
                    <Phone /> Hubungi Cafe
                  </a>
                </Button>
              </div>
            </Card>

            {/* Reservation Summary Details */}
            <Card className="rounded-3xl p-6 md:p-8 gap-5">
              <h2 className="text-base font-bold border-b pb-3">Detail Pemesan & Rincian Menu</h2>

              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <dt className="text-muted-foreground text-[11px]">Nama Pemesan</dt>
                  <dd className="font-bold text-sm">{ticket.customerName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-[11px]">Jumlah Tamu</dt>
                  <dd className="font-bold text-sm">{ticket.guestCount} orang</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-[11px]">Waktu Penyajian</dt>
                  <dd className="font-bold">
                    {ticket.servingTime === "ON_ARRIVAL" && "Saat Tiba"}
                    {ticket.servingTime === "AFTER_30_MIN" && "30 Menit Setelah Tiba"}
                    {ticket.servingTime === "CUSTOM" &&
                      `Pukul ${ticket.servingAt ? formatTimeRange(ticket.servingAt, ticket.servingAt).split("–")[0] : ""} WIB`}
                  </dd>
                </div>
              </dl>

              {ticket.kitchenNote && (
                <div className="p-3 bg-muted/60 border rounded-xl text-xs">
                  <span className="font-bold">Catatan Dapur:</span>{" "}
                  <span className="italic text-muted-foreground">&quot;{ticket.kitchenNote}&quot;</span>
                </div>
              )}

              {/* Items Table */}
              <div className="mt-2">
                <span className="block text-xs font-bold mb-2 uppercase tracking-wider">Menu Yang Dipesan</span>
                <div className="divide-y border rounded-xl overflow-hidden">
                  {ticket.items.map((item) => (
                    <div key={item.id} className="p-3 bg-muted/30 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold">
                          {item.quantity}x {item.productName}
                        </span>
                        {item.option && <span className="text-muted-foreground ml-1">({item.option})</span>}
                      </div>
                      <span className="font-semibold">{formatRupiah(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between p-3 bg-primary/5 rounded-xl">
                  <span className="text-xs font-bold">Total Pre-Order:</span>
                  <span className="text-base font-extrabold">{formatRupiah(ticket.totalAmount)}</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
