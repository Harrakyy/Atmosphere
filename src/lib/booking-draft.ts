"use client";

import { useState, useEffect, useCallback } from "react";

export interface BookingCartItem {
  productId: string;
  productName: string;
  option: string | null;
  kind: "FOOD" | "DRINK";
  unitPrice: number;
  quantity: number;
}

export interface BookingDraft {
  date: string;
  start: string;
  end: string;
  guests: number;
  roomId?: string;
  roomName?: string;
  items: BookingCartItem[];
  servingTime: "ON_ARRIVAL" | "AFTER_30_MIN" | "CUSTOM";
  servingAt?: string;
  kitchenNote?: string;
}

const STORAGE_KEY = "atmosphere_booking_draft";

const defaultDraft: BookingDraft = {
  date: "",
  start: "10:00",
  end: "12:00",
  guests: 2,
  items: [],
  servingTime: "ON_ARRIVAL",
  kitchenNote: "",
};

export function getStoredDraft(): BookingDraft {
  if (typeof window === "undefined") return defaultDraft;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDraft;
    return { ...defaultDraft, ...JSON.parse(raw) };
  } catch {
    return defaultDraft;
  }
}

export function saveStoredDraft(draft: BookingDraft) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function clearStoredDraft() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function useBookingDraft() {
  const [draft, setDraftState] = useState<BookingDraft>(defaultDraft);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setDraftState(getStoredDraft());
    setIsLoaded(true);
  }, []);

  const updateDraft = useCallback((updates: Partial<BookingDraft>) => {
    setDraftState((prev) => {
      const next = { ...prev, ...updates };
      saveStoredDraft(next);
      return next;
    });
  }, []);

  const clearDraft = useCallback(() => {
    clearStoredDraft();
    setDraftState(defaultDraft);
  }, []);

  const totalAmount = draft.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const hasFood = draft.items.some((item) => item.kind === "FOOD");
  const hasDrink = draft.items.some((item) => item.kind === "DRINK");
  const isCartValid = hasFood && hasDrink && draft.items.length > 0;

  return {
    draft,
    isLoaded,
    updateDraft,
    clearDraft,
    totalAmount,
    hasFood,
    hasDrink,
    isCartValid,
  };
}
