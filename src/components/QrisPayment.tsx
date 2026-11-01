"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { CheckCircle2, Download, Loader2, Timer } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";

interface Props {
  token: string;
  code: string;
  qris: string;
  totalAmount: number;
  uniqueCode: number;
  payAmount: number;
  holdExpiresAt: string;
  paymentClaimedAt: string | null;
  onChanged: () => void;
}

const formatTimer = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

export function QrisPayment(props: Props) {
  const { token, code, qris, totalAmount, uniqueCode, payAmount, holdExpiresAt, paymentClaimedAt, onChanged } = props;
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(qris, { width: 480, margin: 2, errorCorrectionLevel: "M" })
      .then(setQrUrl)
      .catch(() => toast.error("Gagal membuat gambar QRIS. Muat ulang halaman."));
  }, [qris]);

  useEffect(() => {
    const expiresAt = new Date(holdExpiresAt).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdExpiresAt]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await fetch(`/api/tickets/${token}/claim-payment`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal mengirim konfirmasi.");
      toast.success("Terima kasih! Admin akan memverifikasi pembayaran Anda.");
      onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim konfirmasi.");
    } finally {
      setClaiming(false);
    }
  };

  const expired = secondsLeft <= 0;

  return (
    <div className="mt-5 w-full max-w-md flex flex-col items-center gap-4 text-left">
      <div className="w-full rounded-2xl border bg-white p-4 flex flex-col items-center gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Scan QRIS untuk membayar
        </span>
        {qrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL hasil generate, bukan aset statis
          <img src={qrUrl} alt={`QRIS pembayaran ${formatRupiah(payAmount)}`} className="size-60 rounded-lg" />
        ) : (
          <div className="size-60 grid place-items-center" aria-label="Membuat QRIS">
            <Loader2 className="animate-spin" />
          </div>
        )}

        <dl className="w-full text-xs flex flex-col gap-1">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total pesanan</dt>
            <dd>{formatRupiah(totalAmount)}</dd>
          </div>
          <div className="flex justify-between text-emerald-700">
            <dt>Kode unik (pencocok pembayaran)</dt>
            <dd>+{formatRupiah(uniqueCode)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 mt-1 text-sm font-extrabold">
            <dt>Bayar tepat</dt>
            <dd>{formatRupiah(payAmount)}</dd>
          </div>
        </dl>

        {qrUrl && (
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href={qrUrl} download={`QRIS-${code}-${payAmount}.png`}>
              <Download /> Unduh QR
            </a>
          </Button>
        )}

        <p className="text-[11px] text-muted-foreground">
          Pesan dari HP? Unduh QR, lalu buka aplikasi e-wallet atau m-banking dan pilih <b>scan dari galeri</b>.
          Nominal sudah terisi otomatis. Kalau tidak, ketik <b>{formatRupiah(payAmount)}</b> persis agar
          pembayaran bisa dicocokkan.
        </p>
      </div>

      {paymentClaimedAt ? (
        <Alert className="border-sky-200 bg-sky-50 text-sky-800" aria-live="polite">
          <Loader2 className="animate-spin" />
          <AlertTitle>Menunggu verifikasi admin</AlertTitle>
          <AlertDescription className="text-sky-700">
            Slot Anda tetap ditahan sampai pukul{" "}
            {new Date(holdExpiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}{" "}
            WIB. Halaman ini akan terbarui otomatis setelah pembayaran dikonfirmasi.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-xl text-center" aria-live="polite">
            <span className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              <Timer className="size-3.5" /> Batas waktu pembayaran
            </span>
            <span className="block text-xl font-mono font-extrabold text-amber-900 mt-0.5">
              {expired ? "Kedaluwarsa" : formatTimer(secondsLeft)}
            </span>
          </div>
          <Button type="button" size="xl" className="w-full" disabled={expired || claiming} onClick={handleClaim}>
            {claiming ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Saya sudah bayar
          </Button>
        </>
      )}
    </div>
  );
}
