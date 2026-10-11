"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { AlertTriangle, ArrowLeft, Loader2, Search, TicketCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CekReservasiPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/tickets/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          phone: phone.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          json.error?.message ||
            "Reservasi tidak ditemukan. Pastikan kode booking dan nomor WhatsApp sudah sesuai."
        );
      }

      router.push(`/tiket/${json.data.ticketToken}`);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Terjadi kesalahan saat mencari tiket."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-md w-full mx-auto p-4 md:py-12 flex flex-col justify-center gap-6">
        <Card className="rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="text-center flex flex-col items-center">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <TicketCheck className="size-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold">Cari & Cek E-Tiket Reservasi</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Masukkan kode reservasi dan nomor WhatsApp yang digunakan saat pemesanan.
            </p>
          </div>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lookup-code" className="text-xs font-bold uppercase text-gray-700">
                Kode Booking
              </Label>
              <Input
                id="lookup-code"
                required
                autoComplete="off"
                maxLength={10}
                placeholder="Contoh: 7K2F"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="h-11 rounded-xl font-mono font-bold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lookup-phone" className="text-xs font-bold uppercase text-gray-700">
                Nomor WhatsApp
              </Label>
              <Input
                id="lookup-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="Contoh: 081234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            <Button type="submit" size="xl" className="mt-2 w-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Search />}
              {loading ? "Mencari..." : "Buka E-Tiket"}
            </Button>
          </form>

          <div className="pt-4 border-t text-center">
            <Button asChild variant="link" size="sm" className="text-muted-foreground">
              <Link href="/">
                <ArrowLeft /> Kembali ke Beranda
              </Link>
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
