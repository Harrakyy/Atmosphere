"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Smartphone, Unplug } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

interface Device {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }) + " WIB";

// K-35: sambungkan HP kasir (app Setor, Protokol Setor) supaya pembayaran QRIS otomatis Lunas
export function DevicesCard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const json = await (await fetch("/api/admin/devices")).json();
      if (json.success) setDevices(json.data);
    } catch {
      toast.error("Gagal memuat daftar HP kasir.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!pairing) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(pairing.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setPairing(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    // Daftar perangkat diperbarui selama kode aktif, supaya HP yang baru tersambung langsung muncul
    const poll = setInterval(load, 5000);
    return () => {
      clearInterval(id);
      clearInterval(poll);
    };
  }, [pairing, load]);

  // QR untuk app Setor (tab Usaha → + → Scan QR): alamat web + kode, format sama dengan Kosinyuk
  useEffect(() => {
    if (!pairing) return setQr(null);
    QRCode.toDataURL(`${window.location.origin}/setor/pair?c=${pairing.code}`, { width: 320, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [pairing]);

  const createCode = async () => {
    setBusy(true);
    try {
      const json = await (await fetch("/api/admin/devices/pairing", { method: "POST" })).json();
      if (!json.success) throw new Error(json.error?.message);
      setPairing(json.data);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Gagal membuat kode pairing.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (d: Device) => {
    if (!confirm(`Cabut akses "${d.name}"? HP itu tidak bisa lagi melaporkan pembayaran.`)) return;
    try {
      const json = await (await fetch(`/api/admin/devices/${d.id}/revoke`, { method: "POST" })).json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success("Akses HP dicabut.");
      load();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Gagal mencabut akses.");
    }
  };

  const active = devices.filter((d) => !d.revokedAt);

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#DFDDD6] shadow-xs flex flex-col gap-4 text-xs">
      <div>
        <h2 className="text-sm font-bold text-[#1C2955] flex items-center gap-2">
          <Smartphone className="size-4" /> HP Kasir (app Setor)
        </h2>
        <p className="text-gray-500 mt-1">
          HP yang tersambung membaca notifikasi DANA &quot;Pembayaran Masuk&quot; lalu otomatis menandai reservasi dengan
          nominal yang cocok sebagai <b>Lunas</b>. Rentang 3 digit terakhir kode unik diatur dari app Setor (tab Usaha → Ubah
          rentang); reservasi baru otomatis mengikuti.
        </p>
      </div>

      {pairing ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col gap-2" aria-live="polite">
          <span className="font-bold text-emerald-900">Di app Setor → tab Usaha → + → Scan QR dari web usaha:</span>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL buatan klien
            <img src={qr} alt={`QR pairing Setor, kode ${pairing.code}`} className="size-44 rounded-xl border border-emerald-200 bg-white p-1" />
          )}
          <span className="font-bold text-emerald-900">Atau ketik manual:</span>
          <span className="text-emerald-800">
            Alamat web: <b className="font-mono">{typeof window !== "undefined" ? window.location.origin : ""}</b>
          </span>
          <span className="text-emerald-800">Kode pairing:</span>
          <span className="font-mono font-extrabold text-3xl tracking-[0.25em] text-emerald-950">{pairing.code}</span>
          <span className="text-emerald-700">
            Berlaku {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")} lagi, hanya bisa dipakai satu kali.
          </span>
        </div>
      ) : (
        <Button type="button" onClick={createCode} disabled={busy} className="self-start">
          {busy ? <Loader2 className="animate-spin" /> : <KeyRound />} Hubungkan HP kasir
        </Button>
      )}

      <div className="flex flex-col divide-y border rounded-2xl">
        {active.length === 0 && <p className="p-4 text-gray-500">Belum ada HP kasir yang tersambung.</p>}
        {active.map((d) => (
          <div key={d.id} className="p-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-sm text-[#1C2955]">{d.name}</p>
              <p className="text-gray-500">
                Tersambung {fmt(d.createdAt)} · {d.lastSeenAt ? `terakhir lapor ${fmt(d.lastSeenAt)}` : "belum pernah lapor"}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => revoke(d)}>
              <Unplug /> Cabut
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
