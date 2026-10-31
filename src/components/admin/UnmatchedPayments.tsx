"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";

interface Unmatched {
  id: string;
  amount: number;
  notifiedAt: string;
  text: string;
  device: { name: string };
}

// Uang masuk dari DANA yang nominalnya tidak cocok dengan reservasi mana pun (K-35)
export function UnmatchedPayments() {
  const [items, setItems] = useState<Unmatched[]>([]);

  const load = useCallback(async () => {
    try {
      const json = await (await fetch("/api/admin/payments/unmatched")).json();
      if (json.success) setItems(json.data);
    } catch {
      // kartu ini pelengkap; dashboard tetap jalan kalau gagal dimuat
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dismiss = async (id: string) => {
    try {
      const json = await (await fetch(`/api/admin/payments/${id}/dismiss`, { method: "POST" })).json();
      if (!json.success) throw new Error(json.error?.message);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Gagal menandai.");
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-sky-900 mb-1">
        <CircleHelp className="size-4" /> Pembayaran tanpa pesanan ({items.length})
      </h2>
      <p className="text-xs text-sky-800 mb-3">
        Uang masuk ke DANA tapi nominalnya tidak cocok dengan reservasi yang menunggu bayar. Cek apakah customer salah
        mengetik nominal, lalu tandai lunas manual dari detail reservasinya.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-sky-200 p-3 text-xs flex items-center justify-between gap-3">
            <div>
              <p className="font-extrabold text-sm text-[#1C2955]">{formatRupiah(p.amount)}</p>
              <p className="text-gray-500">
                {new Date(p.notifiedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })} WIB
                · {p.device.name}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => dismiss(p.id)}>
              <Check /> Sudah dicek
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
