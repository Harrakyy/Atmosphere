"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { formatRupiah, formatDateIndo, formatTimeRange, getStatusInfo } from "@/lib/format";

interface CheckInSummary {
  id: string;
  code: string;
  status: string;
  startAt: string;
  endAt: string;
  guestCount: number;
  customerName: string;
  customerPhone: string;
  servingTime: string;
  totalAmount: number;
  room: {
    name: string;
    location: string | null;
  };
  items: {
    id: string;
    productName: string;
    option: string | null;
    quantity: number;
    lineTotal: number;
  }[];
}

function getTodayWib(): string {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${wib.getFullYear()}-${pad(wib.getMonth() + 1)}-${pad(wib.getDate())}`;
}

export default function AdminCheckInByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  const [summary, setSummary] = useState<CheckInSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/check-in/${code}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Reservasi tidak ditemukan.");
      }
      setSummary(json.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleCheckIn = async () => {
    if (!summary) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/reservations/${summary.id}/check-in`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal melakukan check-in.");
      }
      setSuccessMsg("Tamu berhasil di-check-in!");
      await fetchSummary();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal check-in.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-3 border-[#1C2955]/20 border-t-[#1C2955] rounded-full animate-spin mb-3" />
        <p className="text-xs text-gray-500 font-medium">Memeriksa kode QR check-in...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-rose-200 text-center shadow-xs">
        <p className="text-sm font-bold text-rose-700">⚠️ {errorMsg || "Kode reservasi tidak valid."}</p>
        <Link href="/admin" className="mt-4 inline-block text-xs font-bold text-[#1C2955] underline">
          ← Kembali ke Dashboard Admin
        </Link>
      </div>
    );
  }

  const s = getStatusInfo(summary.status);
  const todayWib = getTodayWib();
  const resWibDate = summary.startAt.slice(0, 10);
  const isToday = todayWib === resWibDate;
  const canCheckIn = summary.status === "CONFIRMED" && isToday;

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-xs font-bold text-[#1C2955] hover:underline">
          ← Kembali ke Dashboard
        </Link>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${s.bg} ${s.text}`}>
          {s.label}
        </span>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl">
          ✓ {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#DFDDD6] shadow-sm flex flex-col gap-5 text-center">
        <div>
          <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
            Hasil Pindai QR Kasir
          </span>
          <h1 className="text-3xl font-extrabold text-[#1C2955] tracking-tight mt-1">
            {summary.code}
          </h1>
          <p className="text-base font-bold text-[#1C2955] mt-1">{summary.customerName}</p>
          <p className="text-xs text-gray-500">{summary.room.name} • {summary.guestCount} Tamu</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs flex flex-col gap-1 text-gray-700 text-left">
          <div className="flex justify-between">
            <span className="text-gray-400">Jadwal:</span>
            <span className="font-bold">{formatDateIndo(summary.startAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Jam:</span>
            <span className="font-bold">{formatTimeRange(summary.startAt, summary.endAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Pre-Order:</span>
            <span className="font-extrabold text-[#1C2955]">{formatRupiah(summary.totalAmount)}</span>
          </div>
        </div>

        {!isToday && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-left">
            ⚠️ Check-in hanya dapat dilakukan pada hari-H reservasi (Tanggal reservasi: {resWibDate}, Hari ini: {todayWib}).
          </div>
        )}

        {summary.status === "CHECKED_IN" && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-bold">
            ✓ Tamu sudah berhasil melakukan check-in dan sedang menikmati ruangan.
          </div>
        )}

        {/* Big Check-in Button */}
        {canCheckIn && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={handleCheckIn}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base rounded-2xl shadow-md active:scale-98 transition-all"
          >
            {actionLoading ? "Memproses..." : "✓ Lakukan Check-In Sekarang"}
          </button>
        )}

        <div className="text-left mt-2">
          <span className="block text-xs font-bold text-gray-700 mb-2">Rincian Menu Tamu:</span>
          <div className="divide-y divide-gray-100 text-xs">
            {summary.items.map((i) => (
              <div key={i.id} className="py-2 flex justify-between">
                <span>{i.quantity}x {i.productName} {i.option && `(${i.option})`}</span>
                <span className="font-semibold text-gray-700">{formatRupiah(i.lineTotal)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
