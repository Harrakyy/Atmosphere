"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/useConfirm";

interface Device {
  id: string;
  name: string;
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  pairedAt: string | null;
  lastSeenAt: string | null;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " WIB";

// K-35: HP kasir dengan aplikasi SetorPantau yang mengirim notifikasi DANA supaya reservasi otomatis Lunas
export function CashierDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState(false);
  const { askConfirm, confirmDialog } = useConfirm();

  const call = useCallback(async (url: string, method = "GET") => {
    const res = await fetch(url, { method });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || "Gagal memuat perangkat.");
    return json.data;
  }, []);

  const load = useCallback(async () => {
    try {
      setDevices(await call("/api/admin/devices"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat perangkat.");
    }
  }, [call]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (url: string, method: string) => {
    setBusy(true);
    try {
      await call(url, method);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (d: Device) => {
    if (!(await askConfirm(`Putuskan "${d.name}"?`, "HP ini tidak bisa lagi menandai pembayaran Lunas sampai dihubungkan ulang."))) return;
    await run(`/api/admin/devices/${d.id}`, "DELETE");
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-gray-500">
        Pasang aplikasi SetorPantau di HP yang menerima notifikasi DANA Bisnis, lalu buka Pengaturan → Hubungkan ke web dan
        masukkan alamat web ini beserta kode pairing. Pembayaran dengan nominal yang cocok akan otomatis ditandai Lunas.
      </p>
      {devices.length === 0 && <p className="text-gray-400">Belum ada HP kasir yang terhubung.</p>}
      <ul className="flex flex-col gap-2">
        {devices.map((d) => (
          <li key={d.id} className="flex items-center gap-3 rounded-xl border border-[#DFDDD6] p-3">
            <Smartphone className="size-4 text-[#1C2955] shrink-0" aria-hidden />
            <div className="flex-1 min-w-0">
              {d.pairingCode ? (
                <>
                  <div className="font-bold text-gray-600">Kode pairing</div>
                  <div className="font-mono text-lg font-extrabold tracking-[0.2em] text-[#1C2955]">{d.pairingCode}</div>
                  <div className="text-[10px] text-gray-400">Berlaku sampai {fmt(d.pairingExpiresAt!)}, sekali pakai</div>
                </>
              ) : (
                <>
                  <div className="font-bold text-gray-700 truncate">{d.name}</div>
                  <div className="text-[10px] text-gray-400">
                    Terhubung {fmt(d.pairedAt!)}
                    {d.lastSeenAt && ` · terakhir aktif ${fmt(d.lastSeenAt)}`}
                  </div>
                </>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => revoke(d)}>
              {d.pairingCode ? "Batalkan" : "Putuskan"}
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button type="button" disabled={busy} onClick={() => run("/api/admin/devices", "POST")}>
          {busy ? <Loader2 className="animate-spin" /> : <Smartphone />}
          Buat kode pairing
        </Button>
      </div>
      {confirmDialog}
    </div>
  );
}
