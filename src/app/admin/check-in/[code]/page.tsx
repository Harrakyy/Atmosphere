"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Clock, Loader2, LogIn, Wallet } from "lucide-react";
import { formatRupiah, formatDateIndo, formatTimeRange, getStatusInfo } from "@/lib/format";
import { todayWib } from "@/server/time";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
      toast.success("Tamu berhasil di-check-in!");
      await fetchSummary();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal check-in.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto flex flex-col gap-4" aria-label="Memeriksa kode check-in">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-80 w-full rounded-3xl" />
      </div>
    );
  }

  if (!summary) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto bg-white">
        <AlertTriangle />
        <AlertTitle>{errorMsg || "Kode reservasi tidak valid."}</AlertTitle>
        <AlertDescription>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/admin">
              <ArrowLeft /> Kembali ke Dashboard Admin
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const s = getStatusInfo(summary.status);
  const today = todayWib();
  const resWibDate = todayWib(new Date(summary.startAt));
  const isToday = today === resWibDate;
  const canCheckIn = summary.status === "CONFIRMED" && isToday;

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin">
            <ArrowLeft /> Kembali ke Dashboard
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

      <Card className="rounded-3xl p-6 md:p-8 shadow-sm gap-5 text-center">
        <div>
          <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
            Check-in Tamu
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">{summary.code}</h1>
          <p className="text-base font-bold mt-1">{summary.customerName}</p>
          <p className="text-xs text-muted-foreground">
            {summary.room.name} • {summary.guestCount} Tamu
          </p>
        </div>

        <dl className="p-4 bg-muted/60 rounded-2xl border text-xs flex flex-col gap-2 text-left">
          <div className="flex justify-between">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="size-3.5" /> Jadwal
            </dt>
            <dd className="font-bold">{formatDateIndo(summary.startAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5" /> Jam
            </dt>
            <dd className="font-bold">{formatTimeRange(summary.startAt, summary.endAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Wallet className="size-3.5" /> Total Pre-Order
            </dt>
            <dd className="font-extrabold">{formatRupiah(summary.totalAmount)}</dd>
          </div>
        </dl>

        {!isToday && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800 text-left">
            <AlertTriangle />
            <AlertDescription className="text-amber-800">
              Check-in hanya dapat dilakukan pada hari-H reservasi (Tanggal reservasi: {resWibDate}, Hari ini: {today}).
            </AlertDescription>
          </Alert>
        )}

        {summary.status === "CHECKED_IN" && (
          <Alert className="border-blue-200 bg-blue-50 text-blue-800 text-left">
            <CheckCircle2 />
            <AlertTitle>Tamu sudah check-in dan sedang menikmati ruangan.</AlertTitle>
          </Alert>
        )}

        {/* Big Check-in Button */}
        {canCheckIn && (
          <Button
            type="button"
            disabled={actionLoading}
            onClick={handleCheckIn}
            className="w-full h-14 rounded-2xl text-base font-extrabold bg-emerald-600 hover:bg-emerald-700 shadow-md"
          >
            {actionLoading ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" />}
            {actionLoading ? "Memproses..." : "Lakukan Check-In Sekarang"}
          </Button>
        )}

        <div className="text-left mt-2">
          <span className="block text-xs font-bold mb-2">Rincian Menu Tamu:</span>
          <div className="divide-y text-xs">
            {summary.items.map((i) => (
              <div key={i.id} className="py-2 flex justify-between">
                <span>
                  {i.quantity}x {i.productName} {i.option && `(${i.option})`}
                </span>
                <span className="font-semibold">{formatRupiah(i.lineTotal)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
