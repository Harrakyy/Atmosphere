"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { useBookingDraft, BookingCartItem } from "@/lib/booking-draft";
import { formatRupiah, formatDateIndo } from "@/lib/format";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Minus,
  Plus,
  Search,
  SearchX,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  options: string[];
  label: string | null;
  photoUrl: string | null;
}

interface Category {
  id: string;
  name: string;
  kind: "FOOD" | "DRINK";
  products: Product[];
}

export default function PilihMenuPage() {
  const router = useRouter();
  const { draft, isLoaded, updateDraft } = useBookingDraft();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cart state
  const [cartItems, setCartItems] = useState<BookingCartItem[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Serving time & notes
  const [servingTime, setServingTime] = useState<"ON_ARRIVAL" | "AFTER_30_MIN" | "CUSTOM">("ON_ARRIVAL");
  const [customServingTime, setCustomServingTime] = useState("");
  const [kitchenNote, setKitchenNote] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!draft.roomId || !draft.date) {
      router.replace("/reservasi/ruangan");
      return;
    }

    if (draft.items) setCartItems(draft.items);
    if (draft.servingTime) setServingTime(draft.servingTime);
    if (draft.servingAt) setCustomServingTime(draft.servingAt);
    if (draft.kitchenNote) setKitchenNote(draft.kitchenNote);

    async function fetchMenu() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/menu");
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || "Gagal memuat daftar menu");
        }
        setCategories(json.data.categories || []);

        // Inisialisasi default selected option untuk produk yang punya options
        const initialOpts: Record<string, string> = {};
        for (const cat of json.data.categories || []) {
          for (const prod of cat.products || []) {
            if (prod.options && prod.options.length > 0) {
              initialOpts[prod.id] = prod.options[0];
            }
          }
        }
        setSelectedOptions(initialOpts);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan koneksi");
      } finally {
        setLoading(false);
      }
    }

    fetchMenu();
  }, [isLoaded, draft.roomId, draft.date, draft.items, draft.servingTime, draft.servingAt, draft.kitchenNote, router]);

  // Handle Cart item addition & removal
  const handleAddItem = (product: Product, kind: "FOOD" | "DRINK") => {
    const option = product.options.length > 0 ? selectedOptions[product.id] || product.options[0] : null;

    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.productId === product.id && i.option === option
      );

      if (existingIdx >= 0) {
        return prev.map((i, idx) => (idx === existingIdx ? { ...i, quantity: i.quantity + 1 } : i));
      }

      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          option,
          kind,
          unitPrice: product.price,
          quantity: 1,
        },
      ];
    });
    toast.success(`${product.name}${option ? ` (${option})` : ""} masuk keranjang`, { duration: 1500 });
  };

  const handleUpdateQty = (productId: string, option: string | null, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((i) => {
          if (i.productId === productId && i.option === option) {
            return { ...i, quantity: i.quantity + delta };
          }
          return i;
        })
        .filter((i) => i.quantity > 0);
    });
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const list: { product: Product; categoryKind: "FOOD" | "DRINK"; categoryName: string }[] = [];

    for (const cat of categories) {
      if (activeCategory !== "ALL" && cat.id !== activeCategory) continue;

      for (const prod of cat.products) {
        if (
          searchQuery.trim() === "" ||
          prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (prod.description && prod.description.toLowerCase().includes(searchQuery.toLowerCase()))
        ) {
          list.push({
            product: prod,
            categoryKind: cat.kind,
            categoryName: cat.name,
          });
        }
      }
    }

    return list;
  }, [categories, activeCategory, searchQuery]);

  const hasFood = cartItems.some((i) => i.kind === "FOOD");
  const hasDrink = cartItems.some((i) => i.kind === "DRINK");
  const isRuleSatisfied = hasFood && hasDrink;
  const totalAmount = cartItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const handleProceedToCheckout = () => {
    setValidationError(null);

    if (!hasFood) {
      setValidationError("Wajib memesan minimal 1 menu makanan (Food/Snack).");
      return;
    }
    if (!hasDrink) {
      setValidationError("Wajib memesan minimal 1 menu minuman (Drink).");
      return;
    }
    if (servingTime === "CUSTOM" && !customServingTime) {
      setValidationError("Harap tentukan jam khusus penyajian makanan.");
      return;
    }

    updateDraft({
      items: cartItems,
      servingTime,
      servingAt: servingTime === "CUSTOM" ? customServingTime : undefined,
      kitchenNote: kitchenNote.trim() || undefined,
    });

    router.push("/reservasi/checkout");
  };

  const itemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const servingOptions = [
    { value: "ON_ARRIVAL", label: "Saat Tiba di Lokasi" },
    { value: "AFTER_30_MIN", label: "30 Menit Setelah Tiba" },
    { value: "CUSTOM", label: "Jam Khusus" },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Stepper currentStep={3} />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 pb-28 lg:pb-8 md:py-8 flex flex-col gap-6">
        {/* Top Summary Info */}
        <Card className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Ruangan & Jadwal Pilihan
            </span>
            <span className="text-sm md:text-base font-bold">
              {draft.roomName || "Ruangan"} • {draft.date ? formatDateIndo(draft.date) : "—"} ({draft.start}–{draft.end} WIB)
            </span>
          </div>

          <Button asChild variant="outline" size="sm">
            <Link href="/reservasi/ruangan">
              <ArrowLeft />
              Ganti Ruangan
            </Link>
          </Button>
        </Card>

        {/* Rule Indicator Notice */}
        <div className="bg-primary text-primary-foreground p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider block text-white/80">
              Syarat Pre-Order Ruang Privat
            </span>
            <span className="text-sm font-semibold">Wajib minimal 1 makanan dan 1 minuman dalam pesanan</span>
          </div>

          <div className="flex items-center gap-2">
            {[
              { ok: hasFood, label: "1 Makanan" },
              { ok: hasDrink, label: "1 Minuman" },
            ].map((rule) => (
              <Badge
                key={rule.label}
                className={rule.ok ? "bg-emerald-500 text-white" : "bg-white/20 text-white/80"}
              >
                {rule.ok ? <CheckCircle2 /> : <Circle />} {rule.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Main Menu Grid & Cart Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Catalog Section (2 Cols) */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Search & Category Filter Tabs */}
            <Card className="p-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Cari menu kopi, makanan, snack..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 pl-9 rounded-xl"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {[{ id: "ALL", name: "Semua Menu" }, ...categories].map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    size="sm"
                    variant={activeCategory === c.id ? "default" : "secondary"}
                    onClick={() => setActiveCategory(c.id)}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            </Card>

            {/* Catalog Items */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="Memuat katalog menu">
                {[0, 1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden p-0 gap-0">
                    <Skeleton className="h-40 w-full rounded-none" />
                    <div className="p-4 flex flex-col gap-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {!loading && error && (
              <Alert variant="destructive" className="bg-white">
                <AlertTriangle />
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}

            {!loading && !error && filteredProducts.length === 0 && (
              <Card className="p-12 items-center text-center text-muted-foreground text-sm">
                <SearchX className="size-8" />
                Tidak ada menu yang sesuai dengan pencarian Anda.
              </Card>
            )}

            {!loading && !error && filteredProducts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.map(({ product, categoryKind }) => {
                  const currentOption = selectedOptions[product.id] || product.options[0];

                  return (
                    <Card
                      key={product.id}
                      className="overflow-hidden p-0 gap-0 justify-between hover:border-primary transition-all"
                    >
                      <div>
                        {product.photoUrl && (
                          <div className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={product.photoUrl}
                              alt={product.name}
                              loading="lazy"
                              className="w-full h-40 object-cover bg-muted"
                            />
                            {/* Foto bukan dari dapur cafe, supaya customer tidak salah ekspektasi */}
                            <span className="absolute bottom-1.5 right-2 text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded">
                              Foto ilustrasi
                            </span>
                          </div>
                        )}
                        <div className="p-4 pb-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-bold text-sm">{product.name}</h3>
                            {product.label && (
                              <Badge className="bg-brand/10 text-brand shrink-0">{product.label}</Badge>
                            )}
                          </div>

                          {product.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{product.description}</p>
                          )}

                          {/* Options Chips (e.g. Hot/Ice) */}
                          {product.options && product.options.length > 0 && (
                            <div className="flex items-center gap-1.5 mb-3 flex-wrap" role="radiogroup" aria-label={`Pilihan ${product.name}`}>
                              <span className="text-[11px] text-muted-foreground font-medium">Pilihan:</span>
                              {product.options.map((opt) => (
                                <Button
                                  key={opt}
                                  type="button"
                                  role="radio"
                                  aria-checked={currentOption === opt}
                                  size="xs"
                                  variant={currentOption === opt ? "default" : "outline"}
                                  className="rounded-full"
                                  onClick={() =>
                                    setSelectedOptions((prev) => ({
                                      ...prev,
                                      [product.id]: opt,
                                    }))
                                  }
                                >
                                  {opt}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mx-4 py-3 border-t flex items-center justify-between mt-2">
                        <span className="text-sm font-extrabold">{formatRupiah(product.price)}</span>

                        <Button type="button" size="sm" onClick={() => handleAddItem(product, categoryKind)}>
                          <Plus />
                          Tambah
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart & Kitchen Serving Panel (1 Col) */}
          <div className="flex flex-col gap-5" id="keranjang">
            <Card className="p-5 sticky top-20 gap-4 shadow-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="flex items-center gap-2 font-bold text-base">
                  <ShoppingBag className="size-4" /> Keranjang Menu
                </h3>
                <Badge variant="secondary">{itemCount} item</Badge>
              </div>

              {/* Items List */}
              {cartItems.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-center text-muted-foreground text-xs">
                  <ShoppingBag className="size-8 opacity-40" />
                  <span>
                    Belum ada menu yang dipilih.
                    <br />
                    Silakan pilih minimal 1 makanan dan 1 minuman.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
                  {cartItems.map((item) => (
                    <div
                      key={`${item.productId}-${item.option}`}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/60 border text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">
                          {item.productName}
                          {item.option && (
                            <span className="text-muted-foreground font-normal ml-1">({item.option})</span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatRupiah(item.unitPrice * item.quantity)}
                        </span>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
                          aria-label={`Kurangi ${item.productName}`}
                          onClick={() => handleUpdateQty(item.productId, item.option, -1)}
                        >
                          {item.quantity === 1 ? <Trash2 /> : <Minus />}
                        </Button>
                        <span className="w-5 text-center font-bold text-xs">{item.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
                          aria-label={`Tambah ${item.productName}`}
                          onClick={() => handleUpdateQty(item.productId, item.option, 1)}
                        >
                          <Plus />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Serving Time Preferences */}
              <fieldset className="pt-3 border-t">
                <legend className="text-xs font-bold mb-2">Waktu Penyajian Makanan</legend>
                <div className="flex flex-col gap-1.5 text-xs">
                  {servingOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        servingTime === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="servingTime"
                        checked={servingTime === opt.value}
                        onChange={() => setServingTime(opt.value)}
                        className="accent-primary"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>

                {servingTime === "CUSTOM" && (
                  <div className="mt-2">
                    <Input
                      type="time"
                      aria-label="Jam penyajian"
                      value={customServingTime}
                      onChange={(e) => setCustomServingTime(e.target.value)}
                      className="text-xs"
                    />
                    <span className="block text-[10px] text-muted-foreground mt-0.5">
                      Antara {draft.start} dan {draft.end} WIB
                    </span>
                  </div>
                )}
              </fieldset>

              {/* Kitchen Note */}
              <div className="pt-2">
                <Label htmlFor="kitchen-note" className="text-xs font-bold mb-1">
                  Catatan Dapur (Opsional)
                </Label>
                <Textarea
                  id="kitchen-note"
                  rows={2}
                  maxLength={300}
                  value={kitchenNote}
                  onChange={(e) => setKitchenNote(e.target.value)}
                  placeholder="Contoh: Sambal dipisah, kurangi gula..."
                  className="text-xs rounded-xl"
                />
              </div>

              {validationError && (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              {/* Total & Checkout Button */}
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground font-medium">Total Tagihan</span>
                  <span className="text-lg font-extrabold">{formatRupiah(totalAmount)}</span>
                </div>

                <Button
                  type="button"
                  variant="brand"
                  size="xl"
                  className="w-full"
                  disabled={!isRuleSatisfied}
                  onClick={handleProceedToCheckout}
                >
                  {isRuleSatisfied ? (
                    <>
                      Lanjut ke Pembayaran <ArrowRight />
                    </>
                  ) : (
                    "Penuhi Syarat Makanan & Minuman"
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Bar keranjang di mobile: keranjang ada di bawah katalog panjang, jadi total & aksi selalu terlihat */}
      {itemCount > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t shadow-[0_-4px_12px_rgba(0,0,0,0.06)] p-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <div>
              <span className="block text-[11px] text-muted-foreground">{itemCount} item</span>
              <span className="text-base font-extrabold">{formatRupiah(totalAmount)}</span>
            </div>
            <Button asChild variant="brand" size="xl">
              <a href="#keranjang">
                Lihat Keranjang <ShoppingBag />
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
