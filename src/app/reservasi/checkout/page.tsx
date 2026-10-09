"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { useBookingDraft } from "@/lib/booking-draft";
import { formatRupiah, formatDateIndo } from "@/lib/format";

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { draft, isLoaded, clearDraft } = useBookingDraft();

  // Customer form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSlotTaken, setIsSlotTaken] = useState(false);

  // Payment session state
  const [snapToken, setSnapToken] = useState<string | null>(null);
  const [ticketToken, setTicketToken] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!draft.roomId || !draft.date || !draft.items || draft.items.length === 0) {
      router.replace("/reservasi/menu");
    }
  }, [isLoaded, draft.roomId, draft.date, draft.items, router]);

  // Countdown timer effect
  useEffect(() => {
    if (!holdExpiresAt) return;

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((holdExpiresAt.getTime() - Date.now()) / 1000));
      setSecondsRemaining(diff);
      if (diff <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [holdExpiresAt]);

  const totalAmount = draft.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSlotTaken(false);

    // Validasi dasar
    if (name.trim().length < 2 || name.trim().length > 80) {
      setErrorMsg("Nama pemesan harus antara 2 dan 80 karakter.");
      return;
    }
    if (!/^08\d{8,11}$|^628\d{8,12}$/.test(phone.replace(/\D/g, ""))) {
      setErrorMsg("Nomor WhatsApp tidak valid (contoh: 081234567890).");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: draft.roomId,
          date: draft.date,
          start: draft.start,
          end: draft.end,
          guestCount: draft.guests,
          items: draft.items.map((i) => ({
            productId: i.productId,
            option: i.option,
            quantity: i.quantity,
          })),
          servingTime: draft.servingTime,
          servingAt: draft.servingAt,
          kitchenNote: draft.kitchenNote,
          customer: {
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim() || undefined,
          },
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (res.status === 409 || json.error?.code === "SLOT_TAKEN") {
          setIsSlotTaken(true);
          throw new Error("Slot ruangan pada jam tersebut baru saja dipesan orang lain.");
        }
        throw new Error(json.error?.message || "Gagal membuat reservasi");
      }

      const data = json.data;
      setSnapToken(data.snapToken);
      setTicketToken(data.ticketToken);
      const expiresAt = new Date(data.holdExpiresAt);
      setHoldExpiresAt(expiresAt);

      // Trigger Snap popup jika tersedia
      triggerSnapPayment(data.snapToken, data.ticketToken, data.snapRedirectUrl);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses pesanan.");
    } finally {
      setLoading(false);
    }
  };

  const triggerSnapPayment = (token: string, targetTicketToken: string, fallbackRedirectUrl?: string) => {
    if (window.snap && window.snap.pay) {
      window.snap.pay(token, {
        onSuccess: () => {
          clearDraft();
          router.push(`/tiket/${targetTicketToken}`);
        },
        onPending: () => {
          clearDraft();
          router.push(`/tiket/${targetTicketToken}`);
        },
        onError: (result) => {
          console.error("Snap error:", result);
          setErrorMsg("Pembayaran gagal atau dibatalkan. Anda dapat mencoba bayar lagi.");
        },
        onClose: () => {
          // Tetap di halaman, pengguna bisa menekan tombol Bayar lagi
        },
      });
    } else if (fallbackRedirectUrl) {
      window.location.href = fallbackRedirectUrl;
    } else {
      router.push(`/tiket/${targetTicketToken}`);
    }
  };

  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "SB-Mid-client-placeholder";
  const snapScriptUrl =
    process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true"
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F2EF]">
      {/* Midtrans Snap Script */}
      <Script
        src={snapScriptUrl}
        data-client-key={clientKey}
        strategy="lazyOnload"
      />

      <Header />
      <Stepper currentStep={4} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1C2955]">
            4. Ringkasan & Pembayaran
          </h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">
            Lengkapi data pemesan dan selesaikan pembayaran untuk mengonfirmasi reservasi Anda.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm font-medium flex flex-col gap-2">
            <div>⚠️ {errorMsg}</div>
            {isSlotTaken && (
              <Link
                href="/reservasi/ruangan"
                className="inline-block text-xs font-bold text-rose-800 underline mt-1"
              >
                ← Kembali dan Pilih Ruangan Lain
              </Link>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Order Details (Left 1.5 Col) */}
          <div className="md:col-span-2 flex flex-col gap-5">
            {/* Form Data Pemesan */}
            <div className="bg-white p-6 rounded-2xl border border-[#DFDDD6] shadow-xs">
              <h2 className="text-base font-bold text-[#1C2955] mb-4">
                Data Pemesan
              </h2>

              <form onSubmit={handlePay} id="checkout-form" className="flex flex-col gap-4">
                <div>
                  <label htmlFor="customer-name" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="customer-name"
                    type="text"
                    required
                    maxLength={80}
                    placeholder="Contoh: Budi Santoso"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={Boolean(snapToken && secondsRemaining > 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFDDD6] focus:border-[#1C2955] outline-none text-sm text-[#1C2955] bg-white disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label htmlFor="customer-phone" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Nomor WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="customer-phone"
                    type="tel"
                    required
                    placeholder="Contoh: 081234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={Boolean(snapToken && secondsRemaining > 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFDDD6] focus:border-[#1C2955] outline-none text-sm text-[#1C2955] bg-white disabled:bg-gray-100"
                  />
                  <span className="block text-[11px] text-gray-500 mt-1">
                    E-tiket dan notifikasi akan dikirimkan ke nomor ini
                  </span>
                </div>

                <div>
                  <label htmlFor="customer-email" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Email (Opsional)
                  </label>
                  <input
                    id="customer-email"
                    type="email"
                    placeholder="Contoh: budi@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={Boolean(snapToken && secondsRemaining > 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFDDD6] focus:border-[#1C2955] outline-none text-sm text-[#1C2955] bg-white disabled:bg-gray-100"
                  />
                </div>
              </form>
            </div>

            {/* Menu Items Snapshot */}
            <div className="bg-white p-6 rounded-2xl border border-[#DFDDD6] shadow-xs">
              <h2 className="text-base font-bold text-[#1C2955] mb-3">
                Rincian Menu Pre-Order
              </h2>

              <div className="divide-y divide-gray-100 text-xs">
                {draft.items.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#1C2955]">
                        {item.quantity}x {item.productName}
                      </span>
                      {item.option && (
                        <span className="text-gray-500 ml-1">({item.option})</span>
                      )}
                    </div>
                    <span className="font-semibold text-gray-700">
                      {formatRupiah(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Summary (Right 1 Col) */}
          <div className="flex flex-col gap-4">
            <div className="bg-white p-6 rounded-2xl border border-[#DFDDD6] shadow-xs flex flex-col gap-4">
              <h3 className="font-bold text-sm text-[#1C2955] border-b border-[#DFDDD6] pb-3">
                Ringkasan Reservasi
              </h3>

              <div className="text-xs flex flex-col gap-2 text-gray-600">
                <div>
                  <span className="font-medium block text-[11px] text-gray-400">Ruangan</span>
                  <span className="font-bold text-[#1C2955] text-sm">{draft.roomName || "—"}</span>
                </div>
                <div>
                  <span className="font-medium block text-[11px] text-gray-400">Jadwal</span>
                  <span className="font-semibold text-[#1C2955]">
                    {draft.date ? formatDateIndo(draft.date) : "—"}
                  </span>
                  <span className="block text-gray-500">
                    {draft.start} – {draft.end} WIB ({draft.guests} orang)
                  </span>
                </div>
                <div>
                  <span className="font-medium block text-[11px] text-gray-400">Waktu Penyajian</span>
                  <span className="font-medium text-[#1C2955]">
                    {draft.servingTime === "ON_ARRIVAL" && "Saat Tiba di Lokasi"}
                    {draft.servingTime === "AFTER_30_MIN" && "30 Menit Setelah Tiba"}
                    {draft.servingTime === "CUSTOM" && `Pukul ${draft.servingAt} WIB`}
                  </span>
                </div>
                {draft.kitchenNote && (
                  <div>
                    <span className="font-medium block text-[11px] text-gray-400">Catatan Dapur</span>
                    <span className="italic text-gray-500">&quot;{draft.kitchenNote}&quot;</span>
                  </div>
                )}
              </div>

              {/* Hold Timer Alert (if snap session created) */}
              {snapToken && holdExpiresAt && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <span className="block text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                    Batas Waktu Pembayaran
                  </span>
                  <span className="block text-xl font-mono font-extrabold text-amber-900 mt-0.5">
                    {secondsRemaining > 0 ? formatTimer(secondsRemaining) : "Kedaluwarsa"}
                  </span>
                  <span className="block text-[10px] text-amber-700 mt-1">
                    Slot ditahan hingga waktu habis
                  </span>
                </div>
              )}

              {/* Total & Action Button */}
              <div className="pt-4 border-t border-[#DFDDD6]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-gray-500 font-medium">Total Pembayaran</span>
                  <span className="text-xl font-extrabold text-[#1C2955]">
                    {formatRupiah(totalAmount)}
                  </span>
                </div>

                {!snapToken ? (
                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={loading}
                    className="w-full py-3.5 bg-[#D81B60] hover:bg-[#B5164F] text-white font-bold text-sm rounded-xl shadow-sm active:scale-98 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? "Memproses..." : "Bayar Sekarang →"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={secondsRemaining <= 0}
                    onClick={() => ticketToken && triggerSnapPayment(snapToken, ticketToken)}
                    className="w-full py-3.5 bg-[#1C2955] hover:bg-[#1A2751] text-white font-bold text-sm rounded-xl shadow-sm active:scale-98 transition-all"
                  >
                    {secondsRemaining > 0 ? "Buka Pembayaran Snap 💳" : "Waktu Habis"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
