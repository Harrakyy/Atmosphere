"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/format";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Plus } from "lucide-react";
import { useConfirm } from "@/components/useConfirm";
import { OptionsEditor } from "@/components/OptionsEditor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

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
  const { askConfirm, confirmDialog } = useConfirm();
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
  const [prodOptions, setProdOptions] = useState<string[]>([]);
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
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah foto.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);

    try {
      const payload = {
        name: prodName.trim(),
        categoryId: prodCategoryId,
        basePrice: Number(prodBasePrice),
        description: prodDescription.trim() || undefined,
        options: prodOptions,
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
      toast.success("Produk disimpan.");
      await fetchData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan produk.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveProduct = async (productId: string) => {
    if (!(await askConfirm("Arsipkan produk ini?", "Produk tidak akan tampil lagi di menu customer."))) return;
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Gagal mengarsipkan produk.");
        return;
      }
      toast.success("Produk diarsipkan.");
      await fetchData();
    } catch {
      toast.error("Gagal mengarsipkan produk. Periksa koneksi lalu coba lagi.");
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
      toast.success("Kategori disimpan.");
      await fetchData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan kategori.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!(await askConfirm("Hapus kategori ini?", "Hanya bisa dihapus jika kategori tidak berisi produk."))) return;
    try {
      const res = await fetch(`/api/admin/categories/${categoryId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Kategori tidak dapat dihapus karena masih berisi produk.");
        return;
      }
      await fetchData();
    } catch {
      toast.error("Gagal menghapus kategori. Periksa koneksi lalu coba lagi.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {confirmDialog}
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
                setProdOptions([]);
                setProdLabel("");
                setProdPhotoUrl("");
                setProdIsAvailable(true);
                setShowProductModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/85"
            >
              <Plus className="size-3.5" /> Tambah Menu
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
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/85"
            >
              <Plus className="size-3.5" /> Tambah Kategori
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="bg-white">
          <AlertTriangle />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Memuat data menu">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-3xl" />
          ))}
        </div>
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
                {p.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photoUrl}
                    alt={p.name}
                    loading="lazy"
                    className="w-full h-32 object-cover rounded-2xl mb-3 bg-gray-100"
                  />
                )}
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
                      setProdOptions(p.options);
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
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProductId ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
            <DialogDescription>Harga online dihitung otomatis dari harga kasir + markup.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProduct} className="flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prod-name" className="text-xs font-bold text-gray-600">Nama Produk</Label>
              <Input
                id="prod-name"
                required
                placeholder="Contoh: Kopi Susu Aren"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prod-category" className="text-xs font-bold text-gray-600">Kategori</Label>
                <Select value={prodCategoryId} onValueChange={setProdCategoryId}>
                  <SelectTrigger id="prod-category" className="w-full">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prod-price" className="text-xs font-bold text-gray-600">Harga Kasir</Label>
                <Input
                  id="prod-price"
                  type="number"
                  min={500}
                  max={10000000}
                  required
                  value={prodBasePrice}
                  onChange={(e) => setProdBasePrice(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-gray-600">Pilihan / Varian (kosongkan kalau tidak ada)</Label>
              <OptionsEditor value={prodOptions} onChange={setProdOptions} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prod-desc" className="text-xs font-bold text-gray-600">Deskripsi Singkat</Label>
              <Textarea
                id="prod-desc"
                rows={2}
                value={prodDescription}
                onChange={(e) => setProdDescription(e.target.value)}
              />
            </div>

            {/* Upload Foto */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prod-photo" className="text-xs font-bold text-gray-600">Foto Menu</Label>
              <Input
                id="prod-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload}
              />
              {uploadingImage && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" /> Mengunggah foto...
                </span>
              )}
              {prodPhotoUrl && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-700">
                  <CheckCircle2 className="size-3" /> Foto terlampir
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prod-label" className="text-xs font-bold text-gray-600">Label Promosi (Opsional)</Label>
                <Input
                  id="prod-label"
                  placeholder="Best Seller / Chef Special"
                  value={prodLabel}
                  onChange={(e) => setProdLabel(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="prod-available"
                  checked={prodIsAvailable}
                  onChange={(e) => setProdIsAvailable(e.target.checked)}
                  className="size-4 accent-primary"
                />
                <Label htmlFor="prod-available" className="font-bold text-gray-700 cursor-pointer">
                  Stok Tersedia
                </Label>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Batal</Button>
              </DialogClose>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading && <Loader2 className="animate-spin" />}
                Simpan Produk
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Tambah/Edit Kategori */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCategoryId ? "Edit Kategori" : "Tambah Kategori Baru"}</DialogTitle>
            <DialogDescription>Jenis menentukan syarat pre-order: minimal 1 makanan dan 1 minuman.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCategory} className="flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-name" className="text-xs font-bold text-gray-600">Nama Kategori</Label>
              <Input
                id="cat-name"
                required
                placeholder="Contoh: Snack & Sides"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-kind" className="text-xs font-bold text-gray-600">Jenis</Label>
              <Select value={catKind} onValueChange={(v) => setCatKind(v as "FOOD" | "DRINK")}>
                <SelectTrigger id="cat-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FOOD">FOOD (Makanan / Snack / Dessert)</SelectItem>
                  <SelectItem value="DRINK">DRINK (Minuman / Kopi / Teh)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Batal</Button>
              </DialogClose>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading && <Loader2 className="animate-spin" />}
                Simpan Kategori
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
