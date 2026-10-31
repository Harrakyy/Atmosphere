"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { useBookingDraft } from "@/lib/booking-draft";
import { formatRupiah, formatDateIndo } from "@/lib/format";
import { createReservationSchema } from "@/contracts";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Clock,
  DoorOpen,
  Loader2,
  Lock,
  NotebookPen,
  ShieldCheck,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CheckoutPage() {
  const router = useRouter();
  const { draft, isLoaded, clearDraft } = useBookingDraft();

  // Customer form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSlotTaken, setIsSlotTaken] = useState(false);
  // Setelah pesanan dibuat draft dikosongkan; jangan sampai efek di bawah melempar ke /reservasi/menu
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isLoaded || submitted) return;

    if (!draft.roomId || !draft.date || !draft.items || draft.items.length === 0) {
      router.replace("/reservasi/menu");
    }
  }, [isLoaded, submitted, draft.roomId, draft.date, draft.items, router]);

  const totalAmount = draft.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSlotTaken(false);

    const customerCheck = createReservationSchema.shape.customer.safeParse({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
    if (!customerCheck.success) {
      setErrorMsg(customerCheck.error.issues[0]?.message ?? "Data pemesan tidak valid.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: draft.roomId,
          date: draft.date,
          start: draft.start,
          end: draft.end,
          guestCount: draft.guests,
          items: draft.items.map((i) => ({
            productId: i.productId,
            option: i.option,
            quantity: i.quantity,
          })),
          servingTime: draft.servingTime,
          servingAt: draft.servingAt,
          kitchenNote: draft.kitchenNote,
          customer: {
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim() || undefined,
          },
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (res.status === 409 || json.error?.code === "SLOT_TAKEN") {
          setIsSlotTaken(true);
          throw new Error("Slot ruangan pada jam tersebut baru saja dipesan orang lain.");
        }
        throw new Error(json.error?.message || "Gagal membuat reservasi");
      }

      // QRIS dinamis ditampilkan di e-tiket supaya customer bisa kembali ke halaman itu kapan saja
      setSubmitted(true);
      clearDraft();
      router.replace(`/tiket/${json.data.ticketToken}`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses pesanan.");
    } finally {
      setLoading(false);
    }
  };

  const servingLabel = {
    ON_ARRIVAL: "Saat Tiba di Lokasi",
    AFTER_30_MIN: "30 Menit Setelah Tiba",
    CUSTOM: `Pukul ${draft.servingAt} WIB`,
  }[draft.servingTime];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Stepper currentStep={4} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">4. Ringkasan & Pembayaran</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Lengkapi data pemesan dan selesaikan pembayaran untuk mengonfirmasi reservasi Anda.
          </p>
        </div>

        {errorMsg && (
          <Alert variant="destructive" className="bg-white">
            <AlertTriangle />
            <AlertTitle>{errorMsg}</AlertTitle>
            {isSlotTaken && (
              <AlertDescription>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href="/reservasi/ruangan">
                    <ArrowLeft />
                    Kembali dan Pilih Ruangan Lain
                  </Link>
                </Button>
              </AlertDescription>
            )}
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Order Details */}
          <div className="md:col-span-2 flex flex-col gap-5">
            {/* Form Data Pemesan */}
            <Card className="p-6">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <UserRound className="size-4" /> Data Pemesan
              </h2>

              <form onSubmit={handlePay} id="checkout-form" className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="customer-name" className="text-xs font-bold uppercase text-gray-700">
                    Nama Lengkap <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="customer-name"
                    required
                    maxLength={80}
                    autoComplete="name"
                    placeholder="Contoh: Budi Santoso"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="customer-phone" className="text-xs font-bold uppercase text-gray-700">
                    Nomor WhatsApp <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="customer-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    placeholder="Contoh: 081234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    E-tiket dan notifikasi akan dikirimkan ke nomor ini
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="customer-email" className="text-xs font-bold uppercase text-gray-700">
                    Email (Opsional)
                  </Label>
                  <Input
                    id="customer-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Contoh: budi@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </form>
            </Card>

            {/* Menu Items Snapshot */}
            <Card className="p-6 gap-3">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <UtensilsCrossed className="size-4" /> Rincian Menu Pre-Order
              </h2>

              <div className="divide-y text-xs">
                {draft.items.map((item) => (
                  <div key={`${item.productId}-${item.option}`} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold">
                        {item.quantity}x {item.productName}
                      </span>
                      {item.option && <span className="text-muted-foreground ml-1">({item.option})</span>}
                    </div>
                    <span className="font-semibold">{formatRupiah(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Sidebar Summary */}
          <div className="flex flex-col gap-4">
            <Card className="p-6 gap-4 md:sticky md:top-20">
              <h3 className="font-bold text-sm border-b pb-3">Ringkasan Reservasi</h3>

              <dl className="text-xs flex flex-col gap-2.5">
                <div className="flex gap-2">
                  <DoorOpen className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Ruangan</dt>
                    <dd className="font-bold text-sm">{draft.roomName || "—"}</dd>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CalendarDays className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Jadwal</dt>
                    <dd className="font-semibold">{draft.date ? formatDateIndo(draft.date) : "—"}</dd>
                    <dd className="text-muted-foreground">
                      {draft.start} – {draft.end} WIB ({draft.guests} orang)
                    </dd>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Clock className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Waktu Penyajian</dt>
                    <dd className="font-medium">{servingLabel}</dd>
                  </div>
                </div>
                {draft.kitchenNote && (
                  <div className="flex gap-2">
                    <NotebookPen className="size-4 text-muted-foreground shrink-0" />
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Catatan Dapur</dt>
                      <dd className="italic text-muted-foreground">&quot;{draft.kitchenNote}&quot;</dd>
                    </div>
                  </div>
                )}
              </dl>

              {/* Total & Action Button */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-muted-foreground font-medium">Total Pembayaran</span>
                  <span className="text-xl font-extrabold">{formatRupiah(totalAmount)}</span>
                </div>

                <Button type="submit" form="checkout-form" variant="brand" size="xl" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" /> Memproses...
                    </>
                  ) : (
                    <>
                      <Lock /> Buat Pesanan &amp; Bayar
                    </>
                  )}
                </Button>
                <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mt-2">
                  <ShieldCheck className="size-3" /> Bayar dengan QRIS (semua e-wallet &amp; m-banking)
                </p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
