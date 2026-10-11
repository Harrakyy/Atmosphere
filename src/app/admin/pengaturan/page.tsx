"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface SettingsData {
  openTime: string;
  closeTime: string;
  slotStepMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  bufferMinutes: number;
  leadDays: number;
  leadCutoffTime: string;
  maxAdvanceDays: number;
  holdMinutes: number;
  paymentExpiryMinutes: number;
  markupBps: number;
  roundingUnit: number;
  vaMinTotal: number;
  cafeWhatsapp: string;
}

export default function AdminPengaturanPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const json = await res.json();
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (json.success) {
        setSettings(json.data);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memuat pengaturan.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal memperbarui pengaturan.");
      }

      setSettings(json.data);
      toast.success("Pengaturan berhasil disimpan!");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col gap-6" aria-label="Memuat pengaturan sistem">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Alert variant="destructive" className="bg-white">
        <AlertTriangle />
        <AlertDescription>{errorMsg || "Gagal memuat pengaturan."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-[#1C2955]">
          Pengaturan Sistem & Operasional
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Atur jam operasional cafe, batas waktu booking, parameter harga online, dan nomor kontak.
        </p>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="bg-white">
          <AlertTriangle />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 md:p-8 border border-[#DFDDD6] shadow-xs flex flex-col gap-6 text-xs">
        {/* Jam Operasional */}
        <div>
          <h2 className="text-sm font-bold text-[#1C2955] border-b border-gray-100 pb-2 mb-3">
            Jam Operasional & Durasi Reservasi
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="setting-open-time" className="font-bold text-gray-600 block mb-1">Jam Buka (WIB)</label>
              <input
                id="setting-open-time"
                type="text"
                value={settings.openTime}
                onChange={(e) => setSettings({ ...settings, openTime: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
              />
            </div>
            <div>
              <label htmlFor="setting-close-time" className="font-bold text-gray-600 block mb-1">Jam Tutup (WIB)</label>
              <input
                id="setting-close-time"
                type="text"
                value={settings.closeTime}
                onChange={(e) => setSettings({ ...settings, closeTime: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
              />
            </div>
            <div>
              <label htmlFor="setting-min-duration" className="font-bold text-gray-600 block mb-1">Min. Durasi (Menit)</label>
              <input
                id="setting-min-duration"
                type="number"
                value={settings.minDurationMinutes}
                onChange={(e) => setSettings({ ...settings, minDurationMinutes: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
              />
            </div>
            <div>
              <label htmlFor="setting-max-duration" className="font-bold text-gray-600 block mb-1">Maks. Durasi (Menit)</label>
              <input
                id="setting-max-duration"
                type="number"
                value={settings.maxDurationMinutes}
                onChange={(e) => setSettings({ ...settings, maxDurationMinutes: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
              />
            </div>
          </div>
        </div>

        {/* Batas Waktu Booking */}
        <div>
          <h2 className="text-sm font-bold text-[#1C2955] border-b border-gray-100 pb-2 mb-3">
            Batas Waktu Reservasi (Lead Time)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="setting-lead-days" className="font-bold text-gray-600 block mb-1">Batas Hari Minimum (Lead Days)</label>
              <input
                id="setting-lead-days"
                type="number"
                value={settings.leadDays}
                onChange={(e) => setSettings({ ...settings, leadDays: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Contoh: 1 = H-1</span>
            </div>
            <div>
              <label htmlFor="setting-lead-cutoff" className="font-bold text-gray-600 block mb-1">Cutoff Time (WIB)</label>
              <input
                id="setting-lead-cutoff"
                type="text"
                value={settings.leadCutoffTime}
                onChange={(e) => setSettings({ ...settings, leadCutoffTime: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Contoh: 21:00</span>
            </div>
            <div>
              <label htmlFor="setting-max-advance" className="font-bold text-gray-600 block mb-1">Batas Hari Maksimum</label>
              <input
                id="setting-max-advance"
                type="number"
                value={settings.maxAdvanceDays}
                onChange={(e) => setSettings({ ...settings, maxAdvanceDays: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Contoh: 30 hari ke depan</span>
            </div>
          </div>
        </div>

        {/* Hold & Expiry Midtrans */}
        <div>
          <h2 className="text-sm font-bold text-[#1C2955] border-b border-gray-100 pb-2 mb-3">
            Waktu Tahan Slot & Pembayaran
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="setting-hold-minutes" className="font-bold text-gray-600 block mb-1">Hold Minutes (Menit Tahan Slot)</label>
              <input
                id="setting-hold-minutes"
                type="number"
                value={settings.holdMinutes}
                onChange={(e) => setSettings({ ...settings, holdMinutes: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Harus lebih besar dari Payment Expiry</span>
            </div>
            <div>
              <label htmlFor="setting-payment-expiry" className="font-bold text-gray-600 block mb-1">Payment Expiry (Menit Batas Snap)</label>
              <input
                id="setting-payment-expiry"
                type="number"
                value={settings.paymentExpiryMinutes}
                onChange={(e) => setSettings({ ...settings, paymentExpiryMinutes: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Durasi Snap token aktif di Midtrans</span>
            </div>
          </div>
        </div>

        {/* Markup & Kontak */}
        <div>
          <h2 className="text-sm font-bold text-[#1C2955] border-b border-gray-100 pb-2 mb-3">
            Markup Harga Online & Kontak WhatsApp
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="setting-markup-bps" className="font-bold text-gray-600 block mb-1">Markup Basis Point (bps)</label>
              <input
                id="setting-markup-bps"
                type="number"
                value={settings.markupBps}
                onChange={(e) => setSettings({ ...settings, markupBps: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">300 bps = 3% kenaikan harga online</span>
            </div>
            <div>
              <label htmlFor="setting-rounding-unit" className="font-bold text-gray-600 block mb-1">Satuan Pembulatan (Rp)</label>
              <input
                id="setting-rounding-unit"
                type="number"
                value={settings.roundingUnit}
                onChange={(e) => setSettings({ ...settings, roundingUnit: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Default: 500 (dibulatkan ke atas)</span>
            </div>
            <div>
              <label htmlFor="setting-cafe-wa" className="font-bold text-gray-600 block mb-1">WhatsApp Cafe (62...)</label>
              <input
                id="setting-cafe-wa"
                type="text"
                value={settings.cafeWhatsapp}
                onChange={(e) => setSettings({ ...settings, cafeWhatsapp: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Nomor admin untuk template chat customer</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[#DFDDD6] flex justify-end">
          <Button type="submit" size="xl" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {saving ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </div>
      </form>
    </div>
  );
}
