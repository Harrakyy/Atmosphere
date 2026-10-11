"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRupiah, formatDateIndo, formatTimeRange, getStatusInfo } from "@/lib/format";
import { AlertTriangle, ArrowRight, CalendarX, LogIn, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface ReservationListItem {
  id: string;
  code: string;
  startAt: string;
  endAt: string;
  guestCount: number;
  customerName: string;
  customerPhone: string;
  status: string;
  totalAmount: number;
  refundStatus: string;
  refundAmount: number;
  room: {
    id: string;
    name: string;
  };
  _count: {
    items: number;
  };
}

function toTodayWibString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function AdminReservasiListPage() {
  const router = useRouter();
  const [checkInCode, setCheckInCode] = useState("");
  const [date, setDate] = useState<string>("");
  const [isAllDates, setIsAllDates] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    setDate(toTodayWibString());
  }, []);

  const [reservations, setReservations] = useState<ReservationListItem[]>([]);
  const [needsActionList, setNeedsActionList] = useState<ReservationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReservations = useCallback(async () => {
    if (!isAllDates && !date) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const query = new URLSearchParams();
      if (!isAllDates && date) {
        query.set("date", date);
      } else {
        query.set("date", "all");
      }
      if (statusFilter !== "ALL") {
        query.set("status", statusFilter);
      }

      const [resListRes, needsActionRes] = await Promise.all([
        fetch(`/api/admin/reservations?${query.toString()}`),
        fetch("/api/admin/needs-action"),
      ]);

      const [resListJson, needsActionJson] = await Promise.all([
        resListRes.json(),
        needsActionRes.json(),
      ]);

      if (resListRes.status === 401) {
        router.push("/admin/login");
        return;
      }

      if (!resListRes.ok || !resListJson.success) {
        throw new Error(resListJson.error?.message || "Gagal memuat reservasi.");
      }

      setReservations(resListJson.data || []);
      if (needsActionRes.ok && needsActionJson.success) {
        setNeedsActionList(needsActionJson.data || []);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  }, [date, isAllDates, router, statusFilter]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-[#1C2955]">
            Daftar Reservasi & Tindakan
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Kelola reservasi harian tamu, status check-in, dan proses refund pembatalan.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={fetchReservations}
          disabled={loading}
          className="self-start sm:self-auto bg-white"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Muat Ulang
        </Button>
      </div>

      {/* Check-in manual: kasir mengetik kode 4 karakter dari tamu */}
      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (checkInCode.length === 4) router.push(`/admin/check-in/${checkInCode}`);
          }}
          className="flex flex-col sm:flex-row sm:items-end gap-3"
        >
          <div className="flex-1">
            <label htmlFor="checkin-code" className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
              Check-in: masukkan kode tamu
            </label>
            <Input
              id="checkin-code"
              value={checkInCode}
              onChange={(e) => setCheckInCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              maxLength={4}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="Contoh: 7K2F"
              aria-label="Kode booking"
              className="h-11 rounded-xl font-mono text-lg font-bold tracking-[0.3em]"
            />
          </div>
          <Button type="submit" size="xl" disabled={checkInCode.length < 4}>
            <LogIn /> Check-in
          </Button>
        </form>
      </Card>

      {/* Needs Action Banner Card (R-B3) */}
      {needsActionList.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-amber-700" />
            <h2 className="text-sm font-bold text-amber-900">
              Perlu Tindakan Admin ({needsActionList.length} Reservasi)
            </h2>
          </div>
          <p className="text-xs text-amber-800 mb-3">
            Reservasi berikut beririsan dengan jadwal pemeliharaan (blokir) atau memiliki status pengembalian dana (refund) yang tertunda:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {needsActionList.map((item) => (
              <Link
                key={item.id}
                href={`/admin/reservasi/${item.id}`}
                className="bg-white p-3 rounded-xl border border-amber-200 hover:border-amber-400 text-xs flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between font-bold text-[#1C2955]">
                    <span>{item.code}</span>
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                      {item.status === "CANCELLED" ? "Refund Tertunda" : "Konflik Blokir"}
                    </span>
                  </div>
                  <div className="text-gray-600 mt-1">
                    {item.customerName} • {item.room.name}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {formatDateIndo(item.startAt)} ({formatTimeRange(item.startAt, item.endAt)})
                  </div>
                </div>
                <span className="inline-flex items-center justify-end gap-1 text-brand font-bold text-[11px] mt-2">
                  Tindak Lanjuti <ArrowRight className="size-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-[#DFDDD6] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="filter-date" className="text-xs font-bold text-gray-600">Tanggal:</label>
            <input
              id="filter-date"
              type="date"
              value={date}
              disabled={isAllDates}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-[#DFDDD6] outline-none text-[#1C2955] font-medium disabled:bg-gray-100"
            />
          </div>

          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllDates}
              onChange={(e) => setIsAllDates(e.target.checked)}
              className="accent-[#1C2955]"
            />
            <span>Semua Tanggal</span>
          </label>
        </div>

        {/* Status Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-status" className="text-xs font-bold text-gray-600">Status:</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="filter-status" size="sm" className="font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="CONFIRMED">CONFIRMED (Terkonfirmasi)</SelectItem>
            <SelectItem value="CHECKED_IN">CHECKED_IN (Sedang Berlangsung)</SelectItem>
            <SelectItem value="PENDING_PAYMENT">PENDING_PAYMENT (Menunggu Bayar)</SelectItem>
            <SelectItem value="COMPLETED">COMPLETED (Selesai)</SelectItem>
            <SelectItem value="CANCELLED">CANCELLED (Dibatalkan)</SelectItem>
            <SelectItem value="EXPIRED">EXPIRED (Kedaluwarsa)</SelectItem>
            <SelectItem value="NO_SHOW">NO_SHOW (Tidak Hadir)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="bg-white">
          <AlertTriangle />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-[#DFDDD6] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-4 flex flex-col gap-3" aria-label="Memuat data reservasi">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-center text-muted-foreground text-sm">
            <CalendarX className="size-8 opacity-50" />
            Tidak ada reservasi yang ditemukan untuk kriteria filter ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-[#DFDDD6] text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Jadwal & Ruangan</th>
                  <th className="py-3 px-4">Pemesan</th>
                  <th className="py-3 px-4">Tamu & Menu</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-[#1C2955]">
                {reservations.map((res) => {
                  const s = getStatusInfo(res.status);

                  return (
                    <tr key={res.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-sm">
                        {res.code}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold">{res.room.name}</div>
                        <div className="text-[11px] text-gray-500">
                          {formatDateIndo(res.startAt)}, {formatTimeRange(res.startAt, res.endAt)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold">{res.customerName}</div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {res.customerPhone}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span>{res.guestCount} orang</span>
                        <span className="text-gray-400 mx-1">•</span>
                        <span className="text-gray-500">{res._count.items} menu</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold">
                        {formatRupiah(res.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge className={`${s.bg} ${s.text}`}>{s.label}</Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button asChild size="sm">
                          <Link href={`/admin/reservasi/${res.id}`}>
                            Detail <ArrowRight />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
