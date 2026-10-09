"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { useBookingDraft, BookingCartItem } from "@/lib/booking-draft";
import { formatRupiah, formatDateIndo } from "@/lib/format";

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
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
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

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F2EF]">
      <Header />
      <Stepper currentStep={3} />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Top Summary Info */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-[#DFDDD6] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Ruangan & Jadwal Pilihan
            </span>
            <span className="text-sm md:text-base font-bold text-[#1C2955]">
              {draft.roomName || "Ruangan"} • {draft.date ? formatDateIndo(draft.date) : "—"} ({draft.start}–{draft.end} WIB)
            </span>
          </div>

          <Link
            href="/reservasi/ruangan"
            className="text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-[#DFDDD6] text-[#1C2955] hover:bg-[#F3F2EF] transition-all"
          >
            ← Ganti Ruangan
          </Link>
        </div>

        {/* Rule Indicator Notice */}
        <div className="bg-[#1C2955] text-white p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider block text-white/80">
              Syarat Pre-Order Ruang Privat
            </span>
            <span className="text-sm font-semibold">
              Wajib minimal 1 makanan dan 1 minuman dalam pesanan
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                hasFood ? "bg-emerald-500 text-white" : "bg-white/20 text-white/80"
              }`}
            >
              {hasFood ? "✓" : "○"} 1 Makanan
            </span>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                hasDrink ? "bg-emerald-500 text-white" : "bg-white/20 text-white/80"
              }`}
            >
              {hasDrink ? "✓" : "○"} 1 Minuman
            </span>
          </div>
        </div>

        {/* Main Menu Grid & Cart Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Catalog Section (2 Cols) */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Search & Category Filter Tabs */}
            <div className="bg-white p-4 rounded-2xl border border-[#DFDDD6] shadow-xs flex flex-col gap-3">
              <input
                type="text"
                placeholder="🔍 Cari menu kopi, makanan, snack..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFDDD6] focus:border-[#1C2955] outline-none text-sm text-[#1C2955] bg-gray-50/50"
              />

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setActiveCategory("ALL")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    activeCategory === "ALL"
                      ? "bg-[#1C2955] text-white"
                      : "bg-[#F3F2EF] text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Semua Menu
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCategory(c.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      activeCategory === c.id
                        ? "bg-[#1C2955] text-white"
                        : "bg-[#F3F2EF] text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Items */}
            {loading && (
              <div className="py-16 text-center bg-white rounded-2xl border border-[#DFDDD6]">
                <div className="inline-block w-8 h-8 border-3 border-[#1C2955]/20 border-t-[#1C2955] rounded-full animate-spin mb-3" />
                <p className="text-xs text-gray-500 font-medium">Memuat katalog menu...</p>
              </div>
            )}

            {!loading && error && (
              <div className="bg-white p-6 rounded-2xl border border-rose-200 text-center text-sm font-semibold text-rose-700">
                ⚠️ {error}
              </div>
            )}

            {!loading && !error && filteredProducts.length === 0 && (
              <div className="bg-white p-12 rounded-2xl border border-[#DFDDD6] text-center text-gray-500 text-sm">
                Tidak ada menu yang sesuai dengan pencarian Anda.
              </div>
            )}

            {!loading && !error && filteredProducts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.map(({ product, categoryKind }) => {
                  const currentOption = selectedOptions[product.id] || product.options[0];

                  return (
                    <div
                      key={product.id}
                      className="bg-white p-4 rounded-2xl border border-[#DFDDD6] hover:border-[#1C2955] transition-all flex flex-col justify-between shadow-xs"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-bold text-sm text-[#1C2955]">{product.name}</h3>
                          {product.label && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#D81B60]/10 text-[#D81B60] rounded-md shrink-0">
                              {product.label}
                            </span>
                          )}
                        </div>

                        {product.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                            {product.description}
                          </p>
                        )}

                        {/* Options Chips (e.g. Hot/Ice) */}
                        {product.options && product.options.length > 0 && (
                          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                            <span className="text-[11px] text-gray-400 font-medium">Pilihan:</span>
                            {product.options.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() =>
                                  setSelectedOptions((prev) => ({
                                    ...prev,
                                    [product.id]: opt,
                                  }))
                                }
                                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                                  currentOption === opt
                                    ? "bg-[#1C2955] text-white border-[#1C2955]"
                                    : "bg-gray-50 text-gray-700 border-[#DFDDD6] hover:border-gray-400"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-2">
                        <span className="text-sm font-extrabold text-[#1C2955]">
                          {formatRupiah(product.price)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleAddItem(product, categoryKind)}
                          className="px-3 py-1.5 bg-[#1C2955] hover:bg-[#1A2751] text-white text-xs font-bold rounded-lg shadow-xs active:scale-95 transition-all"
                        >
                          + Tambah
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart & Kitchen Serving Panel (1 Col) */}
          <div className="flex flex-col gap-5">
            <div className="bg-white p-5 rounded-2xl border border-[#DFDDD6] shadow-sm sticky top-20 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#DFDDD6] pb-3">
                <h3 className="font-bold text-base text-[#1C2955]">Keranjang Menu</h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 bg-[#F3F2EF] text-gray-600 rounded-full">
                  {cartItems.reduce((sum, i) => sum + i.quantity, 0)} item
                </span>
              </div>

              {/* Items List */}
              {cartItems.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  Belum ada menu yang dipilih.<br />Silakan pilih minimal 1 makanan dan 1 minuman.
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
                  {cartItems.map((item, idx) => (
                    <div
                      key={`${item.productId}-${item.option}-${idx}`}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#1C2955] truncate">
                          {item.productName}
                          {item.option && (
                            <span className="text-gray-500 font-normal ml-1">
                              ({item.option})
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500">
                          {formatRupiah(item.unitPrice * item.quantity)}
                        </span>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, item.option, -1)}
                          className="w-6 h-6 rounded-md bg-white border border-[#DFDDD6] flex items-center justify-center font-bold text-gray-700 hover:bg-gray-100"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-bold text-xs text-[#1C2955]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, item.option, 1)}
                          className="w-6 h-6 rounded-md bg-white border border-[#DFDDD6] flex items-center justify-center font-bold text-gray-700 hover:bg-gray-100"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Serving Time Preferences */}
              <div className="pt-3 border-t border-[#DFDDD6]">
                <label className="block text-xs font-bold text-[#1C2955] mb-2">
                  Waktu Penyajian Makanan
                </label>
                <div className="flex flex-col gap-1.5 text-xs">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-[#DFDDD6] hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="servingTime"
                      checked={servingTime === "ON_ARRIVAL"}
                      onChange={() => setServingTime("ON_ARRIVAL")}
                      className="accent-[#1C2955]"
                    />
                    <span>Saat Tiba di Lokasi</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-[#DFDDD6] hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="servingTime"
                      checked={servingTime === "AFTER_30_MIN"}
                      onChange={() => setServingTime("AFTER_30_MIN")}
                      className="accent-[#1C2955]"
                    />
                    <span>30 Menit Setelah Tiba</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-[#DFDDD6] hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="servingTime"
                      checked={servingTime === "CUSTOM"}
                      onChange={() => setServingTime("CUSTOM")}
                      className="accent-[#1C2955]"
                    />
                    <span>Jam Khusus</span>
                  </label>
                </div>

                {servingTime === "CUSTOM" && (
                  <div className="mt-2">
                    <input
                      type="time"
                      value={customServingTime}
                      onChange={(e) => setCustomServingTime(e.target.value)}
                      placeholder="HH:mm"
                      className="w-full px-3 py-1.5 rounded-lg border border-[#DFDDD6] text-xs font-medium text-[#1C2955]"
                    />
                    <span className="block text-[10px] text-gray-400 mt-0.5">
                      Antara {draft.start} dan {draft.end} WIB
                    </span>
                  </div>
                )}
              </div>

              {/* Kitchen Note */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-[#1C2955] mb-1">
                  Catatan Dapur (Opsional)
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={kitchenNote}
                  onChange={(e) => setKitchenNote(e.target.value)}
                  placeholder="Contoh: Sambal dipisah, kurangi gula..."
                  className="w-full p-2.5 text-xs rounded-xl border border-[#DFDDD6] outline-none focus:border-[#1C2955] text-[#1C2955]"
                />
              </div>

              {validationError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                  ⚠️ {validationError}
                </div>
              )}

              {/* Total & Checkout Button */}
              <div className="pt-3 border-t border-[#DFDDD6]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500 font-medium">Total Tagihan</span>
                  <span className="text-lg font-extrabold text-[#1C2955]">
                    {formatRupiah(totalAmount)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!isRuleSatisfied}
                  onClick={handleProceedToCheckout}
                  className={`w-full py-3 rounded-xl font-bold text-xs transition-all shadow-sm ${
                    isRuleSatisfied
                      ? "bg-[#D81B60] hover:bg-[#B5164F] text-white active:scale-98"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {isRuleSatisfied
                    ? "Lanjut ke Pembayaran →"
                    : "Penuhi Syarat Makanan & Minuman"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
