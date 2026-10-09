"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { formatRupiah, formatDateIndo, formatTimeRange, getStatusInfo } from "@/lib/format";

interface DetailItem {
  id: string;
  productName: string;
  option: string | null;
  kind: string;
  unitPrice: number;
  basePrice: number;
  quantity: number;
  lineTotal: number;
}

interface ActivityLogItem {
  id: string;
  action: string;
  actorId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

interface ReservationDetail {
  id: string;
  code: string;
  status: string;
  roomId: string;
  room: {
    id: string;
    name: string;
    location: string | null;
  };
  startAt: string;
  endAt: string;
  guestCount: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  servingTime: string;
  servingAt: string | null;
  kitchenNote: string | null;
  totalAmount: number;
  baseTotal: number;
  paidAt: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  refundStatus: string;
  refundAmount: number;
  refundNote: string | null;
  items: DetailItem[];
  logs: ActivityLogItem[];
  wa: {
    cancelLink: string | null;
  };
}

export default function AdminReservasiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog Modals state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelBy, setCancelBy] = useState<"CAFE" | "CUSTOMER">("CAFE");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRefundAmount, setCancelRefundAmount] = useState<number>(0);

  const [showRefundDoneModal, setShowRefundDoneModal] = useState(false);
  const [refundNote, setRefundNote] = useState("");

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [reschedRoomId, setReschedRoomId] = useState("");
  const [reschedDate, setReschedDate] = useState("");
  const [reschedStart, setReschedStart] = useState("10:00");
  const [reschedEnd, setReschedEnd] = useState("12:00");
  const [roomsList, setRoomsList] = useState<{ id: string; name: string }[]>([]);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/reservations/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal memuat detail reservasi.");
      }
      setDetail(json.data);
      setCancelRefundAmount(json.data.totalAmount);
      setReschedRoomId(json.data.roomId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();

    // Fetch rooms for reschedule modal
    fetch("/api/admin/rooms")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setRoomsList(json.data);
      })
      .catch(() => {});
  }, [fetchDetail]);

  const handleSimpleAction = async (endpoint: string, successMsg?: string) => {
    if (!confirm("Apakah Anda yakin ingin melanjutkan tindakan ini?")) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/reservations/${id}/${endpoint}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal memproses tindakan.");
      }
      if (successMsg) alert(successMsg);
      await fetchDetail();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/reservations/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          by: cancelBy,
          reason: cancelReason.trim() || undefined,
          refundAmount: cancelBy === "CUSTOMER" ? Number(cancelRefundAmount) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal membatalkan reservasi.");
      }
      setShowCancelModal(false);
      await fetchDetail();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal membatalkan reservasi.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRefundDone = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/reservations/${id}/refund-done`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: refundNote.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal menyelesaikan refund.");
      }
      setShowRefundDoneModal(false);
      await fetchDetail();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/reservations/${id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: reschedRoomId,
          date: reschedDate,
          start: reschedStart,
          end: reschedEnd,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal mengubah jadwal reservasi.");
      }
      setShowRescheduleModal(false);
      await fetchDetail();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengubah jadwal.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-3 border-[#1C2955]/20 border-t-[#1C2955] rounded-full animate-spin mb-3" />
        <p className="text-xs text-gray-500 font-medium">Memuat rincian reservasi...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-200 text-center">
        <p className="text-sm font-bold text-rose-700">⚠️ {errorMsg || "Reservasi tidak ditemukan."}</p>
        <Link href="/admin" className="mt-3 inline-block text-xs font-semibold text-[#1C2955] underline">
          ← Kembali ke Daftar
        </Link>
      </div>
    );
  }

  const s = getStatusInfo(detail.status);

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-xs font-bold text-[#1C2955] hover:underline">
          ← Kembali ke Daftar Reservasi
        </Link>

        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${s.bg} ${s.text}`}>
          {s.label}
        </span>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#DFDDD6] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div>
          <span className="text-xs font-mono font-bold text-gray-400">Kode Booking</span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1C2955] tracking-tight">
            {detail.code}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {detail.room.name} • {formatDateIndo(detail.startAt)} ({formatTimeRange(detail.startAt, detail.endAt)})
          </p>
        </div>

        {/* Action Buttons Toolbar based on Status */}
        <div className="flex flex-wrap items-center gap-2">
          {detail.status === "CONFIRMED" && (
            <>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleSimpleAction("check-in", "Tamu berhasil di-check-in!")}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                ✓ Check-In
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setShowRescheduleModal(true)}
                className="px-4 py-2 bg-[#1C2955] hover:bg-[#1A2751] text-white font-bold text-xs rounded-xl shadow-xs"
              >
                🔄 Ubah Jadwal
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleSimpleAction("no-show", "Reservasi ditandai No-Show.")}
                className="px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-xs rounded-xl"
              >
                Tandai No-Show
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setShowCancelModal(true)}
                className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs rounded-xl"
              >
                Batalkan
              </button>
            </>
          )}

          {detail.status === "CHECKED_IN" && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleSimpleAction("complete", "Reservasi selesai.")}
              className="px-5 py-2.5 bg-[#1C2955] hover:bg-[#1A2751] text-white font-bold text-xs rounded-xl shadow-xs"
            >
              ✓ Tandai Selesai
            </button>
          )}

          {detail.status === "CANCELLED" && detail.refundStatus === "PENDING" && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setShowRefundDoneModal(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              💰 Tandai Refund Selesai
            </button>
          )}

          {detail.wa.cancelLink && (
            <a
              href={detail.wa.cancelLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1"
            >
              💬 Kirim WA Pembatalan
            </a>
          )}
        </div>
      </div>

      {/* Grid: 2 Cols Info & Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Guest & Items Info */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Guest & Serving Details */}
          <div className="bg-white p-6 rounded-3xl border border-[#DFDDD6] shadow-xs flex flex-col gap-4">
            <h2 className="text-sm font-bold text-[#1C2955] border-b border-gray-100 pb-2">
              Informasi Pemesan & Sajian
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-gray-400 block text-[11px]">Nama Pemesan</span>
                <span className="font-bold text-[#1C2955] text-sm">{detail.customerName}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Nomor WhatsApp</span>
                <a href={`https://wa.me/${detail.customerPhone}`} target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-700 text-sm hover:underline">
                  {detail.customerPhone}
                </a>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Email</span>
                <span className="font-medium text-gray-700">{detail.customerEmail || "—"}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Jumlah Tamu</span>
                <span className="font-bold text-[#1C2955]">{detail.guestCount} orang</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Waktu Penyajian</span>
                <span className="font-bold text-[#1C2955]">
                  {detail.servingTime === "ON_ARRIVAL" && "Saat Tiba"}
                  {detail.servingTime === "AFTER_30_MIN" && "30 Menit Setelah Tiba"}
                  {detail.servingTime === "CUSTOM" && `Pukul ${detail.servingAt ? formatTimeRange(detail.servingAt, detail.servingAt).split("–")[0] : ""} WIB`}
                </span>
              </div>
            </div>

            {detail.kitchenNote && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                <span className="font-bold text-[#1C2955]">Catatan Dapur:</span>{" "}
                <span className="italic text-gray-700">&quot;{detail.kitchenNote}&quot;</span>
              </div>
            )}
          </div>

          {/* Menu Items Table */}
          <div className="bg-white p-6 rounded-3xl border border-[#DFDDD6] shadow-xs">
            <h2 className="text-sm font-bold text-[#1C2955] border-b border-gray-100 pb-2 mb-3">
              Rincian Menu Pre-Order
            </h2>
            <div className="divide-y divide-gray-100 text-xs">
              {detail.items.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#1C2955]">
                      {item.quantity}x {item.productName}
                    </span>
                    {item.option && <span className="text-gray-500 ml-1">({item.option})</span>}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#1C2955]">
                      {formatRupiah(item.lineTotal)}
                    </span>
                    <span className="block text-[10px] text-gray-400">
                      @ {formatRupiah(item.unitPrice)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#DFDDD6] mt-3 flex items-center justify-between text-xs">
              <span className="font-bold text-gray-500">Total Tagihan Online:</span>
              <span className="font-extrabold text-base text-[#1C2955]">
                {formatRupiah(detail.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Timeline & Refund Info */}
        <div className="flex flex-col gap-6">
          {/* Refund Box if Cancelled */}
          {detail.status === "CANCELLED" && (
            <div className="bg-white p-6 rounded-3xl border border-[#DFDDD6] shadow-xs text-xs flex flex-col gap-3">
              <h3 className="font-bold text-sm text-[#1C2955] border-b border-gray-100 pb-2">
                Informasi Pembatalan & Refund
              </h3>
              <div>
                <span className="text-gray-400 block text-[11px]">Dibatalkan Oleh</span>
                <span className="font-bold text-rose-700">{detail.cancelledBy}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Alasan</span>
                <span className="text-gray-700 italic">&quot;{detail.cancelReason || "Tanpa alasan"}&quot;</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Nominal Refund</span>
                <span className="font-bold text-[#1C2955] text-sm">
                  {formatRupiah(detail.refundAmount)}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Status Refund</span>
                <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  detail.refundStatus === "DONE" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}>
                  {detail.refundStatus === "DONE" ? "Selesai Ditransfer" : "Menunggu Transfer"}
                </span>
              </div>
              {detail.refundNote && (
                <div className="p-2 bg-gray-50 rounded-lg text-gray-600 text-[11px]">
                  Catatan: {detail.refundNote}
                </div>
              )}
            </div>
          )}

          {/* Activity Log Timeline */}
          <div className="bg-white p-6 rounded-3xl border border-[#DFDDD6] shadow-xs text-xs flex flex-col gap-3">
            <h3 className="font-bold text-sm text-[#1C2955] border-b border-gray-100 pb-2">
              Log Riwayat Aktivitas
            </h3>
            <div className="flex flex-col gap-3">
              {detail.logs.map((log) => (
                <div key={log.id} className="relative pl-4 border-l-2 border-gray-200">
                  <div className="font-bold text-[#1C2955] text-xs">{log.action}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(log.createdAt).toLocaleString("id-ID")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Batalkan Reservasi */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-lg border border-[#DFDDD6]">
            <h3 className="text-base font-bold text-[#1C2955] mb-2">
              Batalkan Reservasi {detail.code}
            </h3>
            <form onSubmit={handleConfirmCancel} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="font-bold text-gray-600 block mb-1">Inisiator Pembatalan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCancelBy("CAFE");
                      setCancelRefundAmount(detail.totalAmount);
                    }}
                    className={`p-2 rounded-xl border text-center font-bold ${
                      cancelBy === "CAFE" ? "bg-[#1C2955] text-white border-[#1C2955]" : "bg-gray-50 text-gray-700"
                    }`}
                  >
                    Dari Cafe (Refund 100%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelBy("CUSTOMER")}
                    className={`p-2 rounded-xl border text-center font-bold ${
                      cancelBy === "CUSTOMER" ? "bg-[#1C2955] text-white border-[#1C2955]" : "bg-gray-50 text-gray-700"
                    }`}
                  >
                    Permintaan Customer
                  </button>
                </div>
              </div>

              {cancelBy === "CUSTOMER" && (
                <div>
                  <label htmlFor="cancel-refund-amount" className="font-bold text-gray-600 block mb-1">
                    Nominal Refund (Rp 0 s/d {formatRupiah(detail.totalAmount)})
                  </label>
                  <input
                    id="cancel-refund-amount"
                    type="number"
                    min={0}
                    max={detail.totalAmount}
                    required
                    value={cancelRefundAmount}
                    onChange={(e) => setCancelRefundAmount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-[#DFDDD6] outline-none text-xs text-[#1C2955]"
                  />
                </div>
              )}

              <div>
                <label htmlFor="cancel-reason" className="font-bold text-gray-600 block mb-1">Alasan Pembatalan</label>
                <textarea
                  id="cancel-reason"
                  rows={2}
                  required
                  placeholder="Contoh: Renovasi ruangan mendadak, permintaan customer..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DFDDD6] outline-none text-xs text-[#1C2955]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl"
                >
                  Konfirmasi Pembatalan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Selesaikan Refund */}
      {showRefundDoneModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-lg border border-[#DFDDD6]">
            <h3 className="text-base font-bold text-[#1C2955] mb-2">
              Tandai Refund Selesai Ditransfer
            </h3>
            <form onSubmit={handleConfirmRefundDone} className="flex flex-col gap-4 text-xs">
              <div>
                <label htmlFor="refund-transfer-note" className="font-bold text-gray-600 block mb-1">
                  Catatan Transfer Rekening
                </label>
                <textarea
                  id="refund-transfer-note"
                  rows={3}
                  placeholder="Contoh: Ditransfer via BCA 1234567890 an Budi Santoso tgl 12 Okt"
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DFDDD6] outline-none text-xs text-[#1C2955]"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowRefundDoneModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl"
                >
                  Simpan Refund Selesai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Ubah Jadwal (Reschedule) */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-lg border border-[#DFDDD6]">
            <h3 className="text-base font-bold text-[#1C2955] mb-2">
              Ubah Jadwal Reservasi
            </h3>
            <form onSubmit={handleConfirmReschedule} className="flex flex-col gap-4 text-xs">
              <div>
                <label htmlFor="reschedule-room-select" className="font-bold text-gray-600 block mb-1">Pilih Ruangan</label>
                <select
                  id="reschedule-room-select"
                  value={reschedRoomId}
                  onChange={(e) => setReschedRoomId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DFDDD6] text-xs font-semibold"
                >
                  {roomsList.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="reschedule-date" className="font-bold text-gray-600 block mb-1">Tanggal Baru</label>
                <input
                  id="reschedule-date"
                  type="date"
                  required
                  value={reschedDate}
                  onChange={(e) => setReschedDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DFDDD6] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="reschedule-start-time" className="font-bold text-gray-600 block mb-1">Jam Mulai</label>
                  <input
                    id="reschedule-start-time"
                    type="time"
                    step={1800}
                    value={reschedStart}
                    onChange={(e) => setReschedStart(e.target.value)}
                    className="w-full p-2 rounded-xl border border-[#DFDDD6] text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="reschedule-end-time" className="font-bold text-gray-600 block mb-1">Jam Selesai</label>
                  <input
                    id="reschedule-end-time"
                    type="time"
                    step={1800}
                    value={reschedEnd}
                    onChange={(e) => setReschedEnd(e.target.value)}
                    className="w-full p-2 rounded-xl border border-[#DFDDD6] text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#1C2955] text-white font-bold rounded-xl"
                >
                  Simpan Jadwal Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
