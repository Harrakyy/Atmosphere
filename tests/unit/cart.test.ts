import { describe, it, expect } from "vitest";
import { validateCart, CartItemInput, ProductWithCategory } from "@/server/cart";

describe("cart.ts R-C1 to R-C4", () => {
  const foodProduct: ProductWithCategory = {
    id: "p-food-1",
    name: "Pasta Aglio Olio",
    basePrice: 27000,
    options: [],
    isAvailable: true,
    isArchived: false,
    category: { kind: "FOOD", isActive: true },
  };

  const drinkProductWithOptions: ProductWithCategory = {
    id: "p-drink-1",
    name: "Jeruk",
    basePrice: 15000,
    options: ["Hot", "Ice"],
    isAvailable: true,
    isArchived: false,
    category: { kind: "DRINK", isActive: true },
  };

  const unavailableProduct: ProductWithCategory = {
    id: "p-food-2",
    name: "Unavailable Food",
    basePrice: 20000,
    options: [],
    isAvailable: false,
    isArchived: false,
    category: { kind: "FOOD", isActive: true },
  };

  const productsById = new Map<string, ProductWithCategory>([
    [foodProduct.id, foodProduct],
    [drinkProductWithOptions.id, drinkProductWithOptions],
    [unavailableProduct.id, unavailableProduct],
  ]);

  const settings = { markupBps: 300, roundingUnit: 500 };

  it("merges duplicate items with same productId and option and calculates prices", () => {
    const items: CartItemInput[] = [
      { productId: "p-food-1", option: null, quantity: 1 },
      { productId: "p-drink-1", option: "Ice", quantity: 2 },
      { productId: "p-drink-1", option: "Ice", quantity: 3 },
    ];

    const result = validateCart(items, productsById, settings);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(2);
      const drink = result.items.find((i) => i.productId === "p-drink-1");
      expect(drink?.quantity).toBe(5);
      expect(drink?.unitPrice).toBe(15500); // 15000 -> 15500
      expect(drink?.lineTotal).toBe(15500 * 5);
      expect(result.totalAmount).toBe(28000 + 15500 * 5);
      expect(result.baseTotal).toBe(27000 + 15000 * 5);
    }
  });

  it("R-C1: fails if missing DRINK or missing FOOD", () => {
    // Only food
    const onlyFood: CartItemInput[] = [
      { productId: "p-food-1", option: null, quantity: 2 },
    ];
    const res1 = validateCart(onlyFood, productsById, settings);
    expect(res1.ok).toBe(false);
    if (!res1.ok) {
      expect(res1.error).toContain("minuman");
    }

    // Only drink
    const onlyDrink: CartItemInput[] = [
      { productId: "p-drink-1", option: "Ice", quantity: 2 },
    ];
    const res2 = validateCart(onlyDrink, productsById, settings);
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.error).toContain("makanan");
    }
  });

  it("R-C2: fails if product is unavailable or archived or category inactive", () => {
    const items: CartItemInput[] = [
      { productId: "p-food-2", option: null, quantity: 1 },
      { productId: "p-drink-1", option: "Ice", quantity: 1 },
    ];
    const result = validateCart(items, productsById, settings);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("tidak tersedia");
    }
  });

  it("R-C3: fails if option is missing when product has options, or invalid option", () => {
    // Missing option
    const noOption: CartItemInput[] = [
      { productId: "p-food-1", option: null, quantity: 1 },
      { productId: "p-drink-1", option: null, quantity: 1 },
    ];
    const res1 = validateCart(noOption, productsById, settings);
    expect(res1.ok).toBe(false);

    // Invalid option
    const invalidOption: CartItemInput[] = [
      { productId: "p-food-1", option: null, quantity: 1 },
      { productId: "p-drink-1", option: "Warm", quantity: 1 },
    ];
    const res2 = validateCart(invalidOption, productsById, settings);
    expect(res2.ok).toBe(false);
  });
});
