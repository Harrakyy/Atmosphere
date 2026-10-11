"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDateIndo, formatTimeRange } from "@/lib/format";
import { AlarmClock, AlertTriangle, CupSoda, Printer, Soup } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface KitchenItemTotal {
  productName: string;
  option: string | null;
  kind: "FOOD" | "DRINK";
  quantity: number;
}

interface KitchenReservation {
  id: string;
  code: string;
  customerName: string;
  servingTime: string;
  servingAt: string | null;
  kitchenNote: string | null;
  effectiveServingAt: string;
  startAt: string;
  endAt: string;
  room: {
    name: string;
  };
  items: {
    id: string;
    productName: string;
    option: string | null;
    quantity: number;
    kind: string;
  }[];
}

function toTodayWibString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function AdminDapurPage() {
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    setDate(toTodayWibString());
  }, []);

  const [totals, setTotals] = useState<KitchenItemTotal[]>([]);
  const [reservations, setReservations] = useState<KitchenReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchKitchenData = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/kitchen?date=${date}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal memuat rekap dapur.");
      }
      setTotals(json.data.totals || []);
      setReservations(json.data.reservations || []);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchKitchenData();
  }, [fetchKitchenData]);

  const foodTotals = totals.filter((t) => t.kind === "FOOD");
  const drinkTotals = totals.filter((t) => t.kind === "DRINK");

  return (
    <div className="flex flex-col gap-6">
      {/* Header with Date Filter and Print Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-[#1C2955]">
            Rekap Pesanan Dapur & Bar
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Daftar total porsi dan urutan penyajian makanan/minuman untuk reservasi terkonfirmasi.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3.5 py-2 text-xs rounded-xl border border-[#DFDDD6] outline-none text-[#1C2955] font-semibold bg-white"
          />

          <Button type="button" onClick={() => window.print()}>
            <Printer /> Cetak Rekap
          </Button>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="hidden print-only mb-4 border-b pb-3">
        <h1 className="text-xl font-bold">Atmosphere Cafe — Rekap Dapur</h1>
        <p className="text-xs text-gray-600">
          Tanggal: {formatDateIndo(date)}
        </p>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="bg-white no-print">
          <AlertTriangle />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex flex-col gap-6" aria-label="Memuat rekap dapur">
          <Skeleton className="h-48 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      ) : (
        <>
          {/* Section 1: Total Porsi per Menu */}
          <div className="bg-white rounded-3xl p-6 border border-[#DFDDD6] shadow-xs">
            <h2 className="text-sm font-bold text-[#1C2955] uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
              Total Porsi Menu ({formatDateIndo(date)})
            </h2>

            {totals.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">
                Belum ada pesanan terkonfirmasi untuk tanggal ini.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Makanan */}
                <div>
                  <h3 className="text-xs font-extrabold text-[#1C2955] mb-2 flex items-center gap-1.5">
                    <Soup className="size-4" /> Makanan ({foodTotals.reduce((s, i) => s + i.quantity, 0)} porsi)
                  </h3>
                  <div className="divide-y divide-gray-100 text-xs border border-gray-100 rounded-xl overflow-hidden">
                    {foodTotals.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between bg-gray-50/50">
                        <span className="font-medium text-gray-800">
                          {item.productName}
                          {item.option && (
                            <span className="text-[#D81B60] font-bold ml-1.5 text-[11px]">
                              ({item.option})
                            </span>
                          )}
                        </span>
                        <span className="font-extrabold text-[#1C2955] bg-white px-2.5 py-0.5 rounded-md border border-gray-200">
                          {item.quantity} porsi
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Minuman */}
                <div>
                  <h3 className="text-xs font-extrabold text-[#1C2955] mb-2 flex items-center gap-1.5">
                    <CupSoda className="size-4" /> Minuman ({drinkTotals.reduce((s, i) => s + i.quantity, 0)} gelas)
                  </h3>
                  <div className="divide-y divide-gray-100 text-xs border border-gray-100 rounded-xl overflow-hidden">
                    {drinkTotals.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between bg-gray-50/50">
                        <span className="font-medium text-gray-800">
                          {item.productName}
                          {item.option && (
                            <span className="text-[#D81B60] font-bold ml-1.5 text-[11px]">
                              ({item.option})
                            </span>
                          )}
                        </span>
                        <span className="font-extrabold text-[#1C2955] bg-white px-2.5 py-0.5 rounded-md border border-gray-200">
                          {item.quantity} gelas
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Urutan Penyajian per Reservasi */}
          <div className="bg-white rounded-3xl p-6 border border-[#DFDDD6] shadow-xs">
            <h2 className="text-sm font-bold text-[#1C2955] uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
              Urutan Penyajian per Reservasi ({reservations.length} Reservasi)
            </h2>

            {reservations.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                Tidak ada reservasi yang perlu disiapkan.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reservations.map((res) => {
                  const effectiveDate = new Date(res.effectiveServingAt);
                  const effectiveTimeStr = formatTimeRange(effectiveDate, effectiveDate).split("–")[0];

                  return (
                    <div
                      key={res.id}
                      className="p-4 rounded-2xl border border-[#DFDDD6] bg-gray-50/50 flex flex-col justify-between text-xs gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between font-bold text-[#1C2955] mb-1">
                          <span className="text-sm">{res.code} — {res.room.name}</span>
                          <Badge className="font-mono">
                            <AlarmClock /> {effectiveTimeStr} WIB
                          </Badge>
                        </div>
                        <div className="text-gray-500 text-[11px] mb-2">
                          Pemesan: <span className="font-bold text-gray-700">{res.customerName}</span> (Sesi: {formatTimeRange(res.startAt, res.endAt)})
                        </div>

                        {res.kitchenNote && (
                          <div className="p-2 mb-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] italic">
                            Catatan: &quot;{res.kitchenNote}&quot;
                          </div>
                        )}

                        <div className="divide-y divide-gray-200 border-t border-gray-200 pt-2">
                          {res.items.map((i) => (
                            <div key={i.id} className="py-1 flex justify-between">
                              <span className="font-medium text-gray-800">
                                {i.quantity}x {i.productName} {i.option && <span className="text-[#D81B60] font-bold">({i.option})</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
