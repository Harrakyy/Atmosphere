import { CategoryKind } from "@prisma/client";
import { onlinePrice, PricingSettings } from "./pricing";

export interface ProductWithCategory {
  id: string;
  name: string;
  basePrice: number;
  options: string[];
  isAvailable: boolean;
  isArchived: boolean;
  category: {
    kind: CategoryKind;
    isActive: boolean;
  };
}

export interface CartItemInput {
  productId: string;
  option?: string | null;
  quantity: number;
}

export interface ValidatedCartItem {
  productId: string;
  productName: string;
  option: string | null;
  kind: CategoryKind;
  unitPrice: number;
  basePrice: number;
  quantity: number;
  lineTotal: number;
}

export type CartValidationResult =
  | {
      ok: true;
      items: ValidatedCartItem[];
      totalAmount: number;
      baseTotal: number;
    }
  | {
      ok: false;
      error: string;
    };

export function validateCart(
  rawItems: CartItemInput[],
  productsById: Map<string, ProductWithCategory>,
  pricingSettings: PricingSettings = {}
): CartValidationResult {
  if (!rawItems || rawItems.length === 0) {
    return {
      ok: false,
      error: "Keranjang pesanan tidak boleh kosong.",
    };
  }

  // Merge rows with the same (productId, option)
  const mergedMap = new Map<string, CartItemInput>();
  for (const item of rawItems) {
    if (!item.productId) continue;
    const key = `${item.productId}:::${item.option ?? ""}`;
    const existing = mergedMap.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      mergedMap.set(key, { ...item });
    }
  }

  const mergedItems = Array.from(mergedMap.values());

  // R-C4: Qty per baris 1–200, maksimal 50 baris
  if (mergedItems.length > 50) {
    return {
      ok: false,
      error: "Maksimal 50 jenis produk dalam satu pesanan.",
    };
  }

  const validatedItems: ValidatedCartItem[] = [];
  let hasFood = false;
  let hasDrink = false;
  let totalAmount = 0;
  let baseTotal = 0;

  for (const item of mergedItems) {
    if (item.quantity < 1 || item.quantity > 200) {
      return {
        ok: false,
        error: `Jumlah pesanan per item harus antara 1 dan 200.`,
      };
    }

    const product = productsById.get(item.productId);
    // R-C2: produk ada, isAvailable=true, tidak diarsipkan, dan kategorinya aktif
    if (
      !product ||
      !product.isAvailable ||
      product.isArchived ||
      !product.category.isActive
    ) {
      return {
        ok: false,
        error: `Produk ${product ? product.name : item.productId} tidak tersedia.`,
      };
    }

    // R-C3: Pilihan opsi
    const cleanOption = item.option?.trim() || null;
    if (product.options.length > 0) {
      if (!cleanOption || !product.options.includes(cleanOption)) {
        return {
          ok: false,
          error: `Pilihan untuk ${product.name} harus salah satu dari: ${product.options.join(", ")}.`,
        };
      }
    } else {
      if (cleanOption !== null) {
        return {
          ok: false,
          error: `Produk ${product.name} tidak memiliki pilihan.`,
        };
      }
    }

    if (product.category.kind === CategoryKind.FOOD) {
      hasFood = true;
    } else if (product.category.kind === CategoryKind.DRINK) {
      hasDrink = true;
    }

    const unitPrice = onlinePrice(product.basePrice, pricingSettings);
    const lineTotal = unitPrice * item.quantity;
    totalAmount += lineTotal;
    baseTotal += product.basePrice * item.quantity;

    validatedItems.push({
      productId: product.id,
      productName: product.name,
      option: cleanOption,
      kind: product.category.kind,
      unitPrice,
      basePrice: product.basePrice,
      quantity: item.quantity,
      lineTotal,
    });
  }

  // R-C1: minimal 1 item berjenis FOOD dan 1 item berjenis DRINK
  if (!hasFood) {
    return {
      ok: false,
      error: "Wajib memesan minimal 1 menu makanan (Food/Snack).",
    };
  }
  if (!hasDrink) {
    return {
      ok: false,
      error: "Wajib memesan minimal 1 menu minuman (Drink).",
    };
  }

  return {
    ok: true,
    items: validatedItems,
    totalAmount,
    baseTotal,
  };
}
