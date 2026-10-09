"use client";

import { useEffect, useState, useRef, use, useCallback } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { formatRupiah, formatDateIndo, formatTimeRange, getStatusInfo } from "@/lib/format";

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
  checkInUrl: string;
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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
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

      // Generate QR Code dari checkInUrl
      if (json.data.checkInUrl) {
        const url = await QRCode.toDataURL(json.data.checkInUrl, {
          width: 300,
          margin: 2,
          color: { dark: "#1C2955", light: "#ffffff" },
        });
        setQrDataUrl(url);
      }
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

  const handleCopyCode = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(ticket.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl || !ticket) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${ticket.code}-qr.png`;
    link.click();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F2EF]">
      <Header />
      <Stepper currentStep={5} />

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {loading && (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-3 border-[#1C2955]/20 border-t-[#1C2955] rounded-full animate-spin mb-3" />
            <p className="text-xs text-gray-500 font-medium">Memuat e-tiket reservasi...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white p-8 rounded-2xl border border-rose-200 text-center shadow-xs">
            <h1 className="text-base font-bold text-rose-700 mb-2">⚠️ {error}</h1>
            <p className="text-xs text-gray-500 mb-4">
              Pastikan link e-tiket yang Anda buka sudah benar atau cek kembali di halaman pencarian tiket.
            </p>
            <Link
              href="/cek-reservasi"
              className="inline-block px-5 py-2.5 bg-[#1C2955] text-white text-xs font-bold rounded-xl"
            >
              Cari Reservasi
            </Link>
          </div>
        )}

        {!loading && ticket && (
          <div className="flex flex-col gap-5">
            {/* Ticket Header & Status Card */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#DFDDD6] shadow-sm flex flex-col items-center text-center relative overflow-hidden">
              {/* Status Banner */}
              {(() => {
                const s = getStatusInfo(ticket.status);
                return (
                  <span
                    className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${s.bg} ${s.text}`}
                  >
                    {s.label}
                  </span>
                );
              })()}

              <h1 className="text-2xl md:text-3xl font-extrabold text-[#1C2955] tracking-tight">
                {ticket.room.name}
              </h1>
              <p className="text-xs md:text-sm text-gray-600 mt-1">
                {formatDateIndo(ticket.startAt)} • {formatTimeRange(ticket.startAt, ticket.endAt)}
              </p>

              {/* Booking Code with Copy */}
              <div className="mt-4 flex items-center gap-2 bg-[#F3F2EF] px-4 py-2 rounded-xl border border-[#DFDDD6]">
                <span className="text-xs text-gray-500 font-medium">Kode:</span>
                <span className="font-mono font-extrabold text-base text-[#1C2955]">
                  {ticket.code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-xs text-[#D81B60] font-bold hover:underline ml-1"
                >
                  {copied ? "Tersalin!" : "Salin"}
                </button>
              </div>

              {/* QR Code Container */}
              {qrDataUrl && (
                <div className="mt-6 flex flex-col items-center">
                  <div className="p-3 bg-white border border-[#DFDDD6] rounded-2xl shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt={`QR Code ${ticket.code}`}
                      className="w-48 h-48 rounded-lg"
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 mt-2">
                    Tunjukkan QR code ini ke kasir/staff saat tiba di cafe
                  </span>
                </div>
              )}

              {/* Status Pending Payment notice */}
              {ticket.status === "PENDING_PAYMENT" && (
                <div className="mt-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-center w-full max-w-md">
                  <p className="text-xs font-semibold text-amber-800">
                    ⏳ Menunggu konfirmasi pembayaran...
                  </p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Halaman ini akan otomatis terbarui saat pembayaran berhasil diverifikasi.
                  </p>
                  {ticket.snapRedirectUrl && (
                    <a
                      href={ticket.snapRedirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 px-4 py-2 bg-[#1C2955] text-white text-xs font-bold rounded-lg"
                    >
                      Buka Pembayaran Snap →
                    </a>
                  )}
                </div>
              )}

              {/* Action Buttons: WA & Download QR */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 w-full">
                <a
                  href={ticket.wa.saveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
                >
                  💬 Simpan ke WhatsApp
                </a>

                {qrDataUrl && (
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="px-4 py-2.5 bg-white border border-[#DFDDD6] hover:bg-[#F3F2EF] text-[#1C2955] font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
                  >
                    📥 Unduh QR (PNG)
                  </button>
                )}

                <a
                  href={ticket.wa.contactCafeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-white border border-[#DFDDD6] hover:bg-[#F3F2EF] text-[#1C2955] font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
                >
                  📞 Hubungi Cafe
                </a>
              </div>
            </div>

            {/* Reservation Summary Details */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#DFDDD6] shadow-xs flex flex-col gap-5">
              <h2 className="text-base font-bold text-[#1C2955] border-b border-[#DFDDD6] pb-3">
                Detail Pemesan & Rincian Menu
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 block text-[11px]">Nama Pemesan</span>
                  <span className="font-bold text-[#1C2955] text-sm">{ticket.customerName}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Jumlah Tamu</span>
                  <span className="font-bold text-[#1C2955] text-sm">{ticket.guestCount} orang</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Waktu Penyajian</span>
                  <span className="font-bold text-[#1C2955]">
                    {ticket.servingTime === "ON_ARRIVAL" && "Saat Tiba"}
                    {ticket.servingTime === "AFTER_30_MIN" && "30 Menit Setelah Tiba"}
                    {ticket.servingTime === "CUSTOM" && `Pukul ${ticket.servingAt ? formatTimeRange(ticket.servingAt, ticket.servingAt).split("–")[0] : ""} WIB`}
                  </span>
                </div>
              </div>

              {ticket.kitchenNote && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                  <span className="font-bold text-[#1C2955]">Catatan Dapur:</span>{" "}
                  <span className="italic text-gray-600">&quot;{ticket.kitchenNote}&quot;</span>
                </div>
              )}

              {/* Items Table */}
              <div className="mt-2">
                <span className="block text-xs font-bold text-[#1C2955] mb-2 uppercase tracking-wider">
                  Menu Yang Dipesan
                </span>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                  {ticket.items.map((item) => (
                    <div key={item.id} className="p-3 bg-gray-50/50 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-[#1C2955]">
                          {item.quantity}x {item.productName}
                        </span>
                        {item.option && (
                          <span className="text-gray-500 ml-1">({item.option})</span>
                        )}
                      </div>
                      <span className="font-semibold text-gray-700">
                        {formatRupiah(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between p-3 bg-[#1C2955]/5 rounded-xl">
                  <span className="text-xs font-bold text-[#1C2955]">Total Pre-Order:</span>
                  <span className="text-base font-extrabold text-[#1C2955]">
                    {formatRupiah(ticket.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
