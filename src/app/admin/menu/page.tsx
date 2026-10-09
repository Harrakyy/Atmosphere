"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/format";

interface AdminCategory {
  id: string;
  name: string;
  kind: "FOOD" | "DRINK";
  sortOrder: number;
  isActive: boolean;
  _count?: {
    products: number;
  };
}

interface AdminProduct {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  onlinePrice: number;
  options: string[];
  label: string | null;
  photoUrl: string | null;
  isAvailable: boolean;
  isArchived: boolean;
  categoryId: string;
  category: {
    id: string;
    name: string;
    kind: "FOOD" | "DRINK";
  };
}

export default function AdminMenuPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"PRODUCTS" | "CATEGORIES">("PRODUCTS");

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Product Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState("");
  const [prodCategoryId, setProdCategoryId] = useState("");
  const [prodBasePrice, setProdBasePrice] = useState(25000);
  const [prodDescription, setProdDescription] = useState("");
  const [prodOptionsStr, setProdOptionsStr] = useState("");
  const [prodLabel, setProdLabel] = useState("");
  const [prodIsAvailable, setProdIsAvailable] = useState(true);
  const [prodPhotoUrl, setProdPhotoUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Category Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [catKind, setCatKind] = useState<"FOOD" | "DRINK">("FOOD");

  const fetchData = useCallback(async () => {
    try {
      const [prodsRes, catsRes] = await Promise.all([
        fetch("/api/admin/products"),
        fetch("/api/admin/categories"),
      ]);

      const [prodsJson, catsJson] = await Promise.all([
        prodsRes.json(),
        catsRes.json(),
      ]);

      if (prodsRes.status === 401) {
        router.push("/admin/login");
        return;
      }

      if (prodsJson.success) setProducts(prodsJson.data || []);
      if (catsJson.success) {
        setCategories(catsJson.data || []);
        if (catsJson.data.length > 0 && !prodCategoryId) {
          setProdCategoryId(catsJson.data[0].id);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memuat data menu.");
    } finally {
      setLoading(false);
    }
  }, [prodCategoryId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal mengunggah foto.");
      }

      setProdPhotoUrl(json.data.url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal mengunggah foto.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);

    try {
      const optionsArray = prodOptionsStr
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

      const payload = {
        name: prodName.trim(),
        categoryId: prodCategoryId,
        basePrice: Number(prodBasePrice),
        description: prodDescription.trim() || undefined,
        options: optionsArray,
        label: prodLabel.trim() || null,
        photoUrl: prodPhotoUrl.trim() || null,
        isAvailable: prodIsAvailable,
      };

      const url = editingProductId ? `/api/admin/products/${editingProductId}` : "/api/admin/products";
      const method = editingProductId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal menyimpan produk.");
      }

      setShowProductModal(false);
      setEditingProductId(null);
      await fetchData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan produk.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveProduct = async (productId: string) => {
    if (!confirm("Arsipkan produk ini?")) return;
    try {
      await fetch(`/api/admin/products/${productId}`, { method: "DELETE" });
      await fetchData();
    } catch {
      // ignore
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);

    try {
      const payload = {
        name: catName.trim(),
        kind: catKind,
      };

      const url = editingCategoryId ? `/api/admin/categories/${editingCategoryId}` : "/api/admin/categories";
      const method = editingCategoryId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal menyimpan kategori.");
      }

      setShowCategoryModal(false);
      setEditingCategoryId(null);
      await fetchData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan kategori.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("Hapus kategori ini? (Hanya bisa dihapus jika tidak ada produk)")) return;
    try {
      const res = await fetch(`/api/admin/categories/${categoryId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error?.message || "Kategori tidak dapat dihapus karena masih berisi produk.");
        return;
      }
      await fetchData();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-[#1C2955]">
            Katalog Menu & Kategori
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Atur harga kasir, markup harga online, variasi pilihan, dan ketersediaan stok.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "PRODUCTS" ? (
            <button
              type="button"
              onClick={() => {
                setEditingProductId(null);
                setProdName("");
                setProdBasePrice(25000);
                setProdDescription("");
                setProdOptionsStr("");
                setProdLabel("");
                setProdPhotoUrl("");
                setProdIsAvailable(true);
                setShowProductModal(true);
              }}
              className="px-4 py-2 bg-[#1C2955] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#1A2751]"
            >
              + Tambah Menu
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingCategoryId(null);
                setCatName("");
                setCatKind("FOOD");
                setShowCategoryModal(true);
              }}
              className="px-4 py-2 bg-[#1C2955] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#1A2751]"
            >
              + Tambah Kategori
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex border-b border-[#DFDDD6] text-xs font-bold gap-6">
        <button
          type="button"
          onClick={() => setActiveTab("PRODUCTS")}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === "PRODUCTS"
              ? "border-[#1C2955] text-[#1C2955]"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          Produk ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("CATEGORIES")}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === "CATEGORIES"
              ? "border-[#1C2955] text-[#1C2955]"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          Kategori ({categories.length})
        </button>
      </div>

      {/* Tabs Content */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">Memuat data menu...</div>
      ) : activeTab === "PRODUCTS" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className={`bg-white p-5 rounded-3xl border shadow-xs flex flex-col justify-between transition-all ${
                !p.isAvailable || p.isArchived ? "opacity-60 border-gray-200" : "border-[#DFDDD6]"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <h3 className="font-bold text-sm text-[#1C2955]">{p.name}</h3>
                    <span className="text-[10px] text-gray-400 block">
                      {p.category.name} ({p.category.kind})
                    </span>
                  </div>
                  {p.label && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-[#D81B60]/10 text-[#D81B60] rounded-md">
                      {p.label}
                    </span>
                  )}
                </div>

                {p.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 my-2">{p.description}</p>
                )}

                {/* Options Chips */}
                {p.options && p.options.length > 0 && (
                  <div className="flex flex-wrap gap-1 my-2">
                    {p.options.map((opt) => (
                      <span key={opt} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {opt}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Harga Kasir</span>
                    <span className="font-semibold text-gray-700">{formatRupiah(p.basePrice)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 block text-[10px]">Harga Online (+Markup)</span>
                    <span className="font-extrabold text-[#1C2955]">{formatRupiah(p.onlinePrice)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  p.isAvailable ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"
                }`}>
                  {p.isAvailable ? "Tersedia" : "Habis"}
                </span>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProductId(p.id);
                      setProdName(p.name);
                      setProdCategoryId(p.categoryId);
                      setProdBasePrice(p.basePrice);
                      setProdDescription(p.description || "");
                      setProdOptionsStr(p.options.join(", "));
                      setProdLabel(p.label || "");
                      setProdPhotoUrl(p.photoUrl || "");
                      setProdIsAvailable(p.isAvailable);
                      setShowProductModal(true);
                    }}
                    className="font-bold text-[#1C2955] hover:underline"
                  >
                    Edit
                  </button>
                  {!p.isArchived && (
                    <button
                      type="button"
                      onClick={() => handleArchiveProduct(p.id)}
                      className="font-bold text-rose-600 hover:underline"
                    >
                      Arsipkan
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-[#DFDDD6] shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-[#DFDDD6] text-gray-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Nama Kategori</th>
                <th className="py-3 px-4">Jenis (Aturan Reservasi)</th>
                <th className="py-3 px-4">Jumlah Produk</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-[#1C2955]">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/80">
                  <td className="py-3.5 px-4 font-bold text-sm">{c.name}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                      c.kind === "FOOD" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {c.kind}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-500">{c._count?.products || 0} produk</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(c.id);
                        setCatName(c.name);
                        setCatKind(c.kind);
                        setShowCategoryModal(true);
                      }}
                      className="font-bold text-[#1C2955] hover:underline mr-4"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(c.id)}
                      className="font-bold text-rose-600 hover:underline"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: Tambah/Edit Produk */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-lg border border-[#DFDDD6] max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#1C2955] mb-4">
              {editingProductId ? "Edit Produk" : "Tambah Produk Baru"}
            </h3>

            <form onSubmit={handleSaveProduct} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-gray-600 block mb-1">Nama Produk</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kopi Susu Aren"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Kategori</label>
                  <select
                    value={prodCategoryId}
                    onChange={(e) => setProdCategoryId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Harga Kasir (Base Price)</label>
                  <input
                    type="number"
                    min={500}
                    max={10000000}
                    required
                    value={prodBasePrice}
                    onChange={(e) => setProdBasePrice(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Pilihan / Varian (Pisahkan koma)</label>
                <input
                  type="text"
                  placeholder="Contoh: Hot, Ice (atau kosongkan)"
                  value={prodOptionsStr}
                  onChange={(e) => setProdOptionsStr(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
                />
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Deskripsi Singkat</label>
                <textarea
                  rows={2}
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
                />
              </div>

              {/* Upload Foto */}
              <div>
                <label className="font-bold text-gray-600 block mb-1">Foto Menu (Vercel Blob)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-gray-500"
                />
                {uploadingImage && <span className="text-[11px] text-gray-400 mt-1 block">Mengunggah foto...</span>}
                {prodPhotoUrl && <span className="text-[11px] text-emerald-700 mt-1 block">✓ Foto terlampir</span>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Label Promosi (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Best Seller / Chef Special"
                    value={prodLabel}
                    onChange={(e) => setProdLabel(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="prod-available"
                    checked={prodIsAvailable}
                    onChange={(e) => setProdIsAvailable(e.target.checked)}
                    className="accent-[#1C2955]"
                  />
                  <label htmlFor="prod-available" className="font-bold text-gray-700 cursor-pointer">
                    Stok Tersedia
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t mt-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 font-bold text-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#1C2955] text-white font-bold rounded-xl"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tambah/Edit Kategori */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-lg border border-[#DFDDD6]">
            <h3 className="text-base font-bold text-[#1C2955] mb-4">
              {editingCategoryId ? "Edit Kategori" : "Tambah Kategori Baru"}
            </h3>

            <form onSubmit={handleSaveCategory} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-gray-600 block mb-1">Nama Kategori</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Snack & Sides"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
                />
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Jenis (FOOD / DRINK)</label>
                <select
                  value={catKind}
                  onChange={(e) => setCatKind(e.target.value as "FOOD" | "DRINK")}
                  className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
                >
                  <option value="FOOD">FOOD (Makanan / Snack / Dessert)</option>
                  <option value="DRINK">DRINK (Minuman / Kopi / Teh)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t mt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 font-bold text-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#1C2955] text-white font-bold rounded-xl"
                >
                  Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
