"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { formatRupiah, formatDateIndo, formatTimeRange, getStatusInfo } from "@/lib/format";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCheck,
  Loader2,
  LogIn,
  MessageCircle,
  UserX,
  Wallet,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface PendingAction {
  endpoint: "check-in" | "no-show" | "complete";
  title: string;
  successMsg: string;
}

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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

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

  const runSimpleAction = async ({ endpoint, successMsg }: PendingAction) => {
    setPendingAction(null);
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
      toast.success(successMsg);
      await fetchDetail();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setErrorMsg(message);
      toast.error(message);
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
      toast.success("Reservasi dibatalkan. Kirim WA pembatalan ke tamu.");
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
      toast.success("Refund ditandai selesai.");
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
      toast.success("Jadwal reservasi diperbarui.");
      await fetchDetail();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengubah jadwal.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6" aria-label="Memuat rincian reservasi">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-32 w-full rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <Alert variant="destructive" className="bg-white">
        <AlertTriangle />
        <AlertDescription>
          {errorMsg || "Reservasi tidak ditemukan."}
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/admin">
              <ArrowLeft /> Kembali ke Daftar
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const s = getStatusInfo(detail.status);

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin">
            <ArrowLeft /> Kembali ke Daftar Reservasi
          </Link>
        </Button>

        <Badge className={`px-3 py-1 h-auto uppercase ${s.bg} ${s.text}`}>{s.label}</Badge>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="bg-white">
          <AlertTriangle />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
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
              <Button
                type="button"
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={actionLoading}
                onClick={() =>
                  setPendingAction({ endpoint: "check-in", title: "Check-in tamu ini?", successMsg: "Tamu berhasil di-check-in!" })
                }
              >
                <LogIn /> Check-In
              </Button>
              <Button type="button" size="lg" disabled={actionLoading} onClick={() => setShowRescheduleModal(true)}>
                <CalendarClock /> Ubah Jadwal
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="bg-purple-100 text-purple-800 hover:bg-purple-200"
                disabled={actionLoading}
                onClick={() =>
                  setPendingAction({
                    endpoint: "no-show",
                    title: "Tandai tamu tidak hadir (No-Show)?",
                    successMsg: "Reservasi ditandai No-Show.",
                  })
                }
              >
                <UserX /> Tandai No-Show
              </Button>
              <Button
                type="button"
                size="lg"
                variant="destructive"
                disabled={actionLoading}
                onClick={() => setShowCancelModal(true)}
              >
                <XCircle /> Batalkan
              </Button>
            </>
          )}

          {detail.status === "CHECKED_IN" && (
            <Button
              type="button"
              size="lg"
              disabled={actionLoading}
              onClick={() =>
                setPendingAction({ endpoint: "complete", title: "Tandai reservasi selesai?", successMsg: "Reservasi selesai." })
              }
            >
              <CheckCheck /> Tandai Selesai
            </Button>
          )}

          {detail.status === "CANCELLED" && detail.refundStatus === "PENDING" && (
            <Button
              type="button"
              size="lg"
              className="bg-amber-600 hover:bg-amber-700"
              disabled={actionLoading}
              onClick={() => setShowRefundDoneModal(true)}
            >
              <Wallet /> Tandai Refund Selesai
            </Button>
          )}

          {detail.wa.cancelLink && (
            <Button asChild size="lg" className="bg-emerald-600 hover:bg-emerald-700">
              <a href={detail.wa.cancelLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> Kirim WA Pembatalan
              </a>
            </Button>
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

      {/* KONFIRMASI: Check-in / No-show / Selesai */}
      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              Reservasi {detail.code} atas nama {detail.customerName}. Tindakan ini tercatat di log aktivitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingAction && runSimpleAction(pendingAction)}>
              Ya, Lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL: Batalkan Reservasi */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batalkan Reservasi {detail.code}</DialogTitle>
            <DialogDescription>Customer akan dihubungi lewat template WA setelah pembatalan.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmCancel} className="flex flex-col gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-gray-600">Inisiator Pembatalan</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={cancelBy === "CAFE" ? "default" : "outline"}
                  className="h-auto py-2 whitespace-normal"
                  onClick={() => {
                    setCancelBy("CAFE");
                    setCancelRefundAmount(detail.totalAmount);
                  }}
                >
                  Dari Cafe (Refund 100%)
                </Button>
                <Button
                  type="button"
                  variant={cancelBy === "CUSTOMER" ? "default" : "outline"}
                  className="h-auto py-2 whitespace-normal"
                  onClick={() => setCancelBy("CUSTOMER")}
                >
                  Permintaan Customer
                </Button>
              </div>
            </div>

            {cancelBy === "CUSTOMER" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cancel-refund-amount" className="text-xs font-bold text-gray-600">
                  Nominal Refund (Rp 0 s/d {formatRupiah(detail.totalAmount)})
                </Label>
                <Input
                  id="cancel-refund-amount"
                  type="number"
                  min={0}
                  max={detail.totalAmount}
                  required
                  value={cancelRefundAmount}
                  onChange={(e) => setCancelRefundAmount(Number(e.target.value))}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cancel-reason" className="text-xs font-bold text-gray-600">
                Alasan Pembatalan
              </Label>
              <Textarea
                id="cancel-reason"
                rows={2}
                required
                placeholder="Contoh: Renovasi ruangan mendadak, permintaan customer..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Batal
                </Button>
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={actionLoading}>
                {actionLoading && <Loader2 className="animate-spin" />}
                Konfirmasi Pembatalan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Selesaikan Refund */}
      <Dialog open={showRefundDoneModal} onOpenChange={setShowRefundDoneModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tandai Refund Selesai Ditransfer</DialogTitle>
            <DialogDescription>Nominal refund: {formatRupiah(detail.refundAmount)}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmRefundDone} className="flex flex-col gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="refund-transfer-note" className="text-xs font-bold text-gray-600">
                Catatan Transfer Rekening
              </Label>
              <Textarea
                id="refund-transfer-note"
                rows={3}
                placeholder="Contoh: Ditransfer via BCA 1234567890 an Budi Santoso tgl 12 Okt"
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Batal
                </Button>
              </DialogClose>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={actionLoading}>
                {actionLoading && <Loader2 className="animate-spin" />}
                Simpan Refund Selesai
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Ubah Jadwal (Reschedule) */}
      <Dialog open={showRescheduleModal} onOpenChange={setShowRescheduleModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah Jadwal Reservasi</DialogTitle>
            <DialogDescription>Batas pemesanan H-1 tidak berlaku untuk reschedule oleh admin.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmReschedule} className="flex flex-col gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reschedule-room-select" className="text-xs font-bold text-gray-600">
                Pilih Ruangan
              </Label>
              <Select value={reschedRoomId} onValueChange={setReschedRoomId}>
                <SelectTrigger id="reschedule-room-select" className="w-full">
                  <SelectValue placeholder="Pilih ruangan" />
                </SelectTrigger>
                <SelectContent>
                  {roomsList.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reschedule-date" className="text-xs font-bold text-gray-600">
                Tanggal Baru
              </Label>
              <Input
                id="reschedule-date"
                type="date"
                required
                value={reschedDate}
                onChange={(e) => setReschedDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reschedule-start-time" className="text-xs font-bold text-gray-600">
                  Jam Mulai
                </Label>
                <Input
                  id="reschedule-start-time"
                  type="time"
                  step={1800}
                  value={reschedStart}
                  onChange={(e) => setReschedStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reschedule-end-time" className="text-xs font-bold text-gray-600">
                  Jam Selesai
                </Label>
                <Input
                  id="reschedule-end-time"
                  type="time"
                  step={1800}
                  value={reschedEnd}
                  onChange={(e) => setReschedEnd(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Batal
                </Button>
              </DialogClose>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading && <Loader2 className="animate-spin" />}
                Simpan Jadwal Baru
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
