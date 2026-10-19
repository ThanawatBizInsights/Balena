// Trial cart: shared by every trial page, saved in this browser under its own key so it never
// touches anything else. Only product and variant ids and quantities are stored, nothing
// personal. Totals are computed in satang (integers).
import { useSyncExternalStore } from "react";
import { bySlug, variantOf, type Product, type Variant } from "../data/products";
import { priceOf } from "./pricing";

const KEY = "balena-trial-cart-v1";
export const MAX_QTY = 20;

export type CartLine = { productId: string; variantId: string; qty: number };

let lines: CartLine[] = load();
const listeners = new Set<() => void>();

function load(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l) => l && typeof l.productId === "string" && typeof l.variantId === "string" && Number.isInteger(l.qty) && l.qty > 0)
      .map((l) => ({ productId: l.productId, variantId: l.variantId, qty: Math.min(MAX_QTY, l.qty) }));
  } catch {
    return [];
  }
}

function commit(next: CartLine[]) {
  lines = next;
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* not saved, still works this visit */ }
  listeners.forEach((l) => l());
}

export const keyOf = (l: { productId: string; variantId: string }) => `${l.productId}:${l.variantId}`;

export function addToCart(productId: string, variantId: string, qty: number) {
  const k = keyOf({ productId, variantId });
  const found = lines.find((l) => keyOf(l) === k);
  commit(found
    ? lines.map((l) => (keyOf(l) === k ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l))
    : [...lines, { productId, variantId, qty: Math.min(MAX_QTY, qty) }]);
}
export function setQty(key: string, qty: number) {
  commit(qty <= 0 ? lines.filter((l) => keyOf(l) !== key) : lines.map((l) => (keyOf(l) === key ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)));
}
export function removeLine(key: string) { commit(lines.filter((l) => keyOf(l) !== key)); }
export function clearCart() { commit([]); }

// Keep tabs in step.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) { lines = load(); listeners.forEach((l) => l()); } });
}

export function useCart(): CartLine[] {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => lines, () => []);
}

export type PricedLine = CartLine & {
  key: string;
  product: Product | null;
  variant: Variant | null;
  unit: number | null;
  isTest: boolean;
  lineTotal: number;
  /** False when the product, variant or its price is no longer available. */
  ok: boolean;
};

export function priceLines(cart: CartLine[], testPrices: boolean) {
  const priced: PricedLine[] = cart.map((l) => {
    const product = bySlug(l.productId);
    const variant = product ? variantOf(product, l.variantId) : null;
    const { amount, isTest } = priceOf(variant, testPrices);
    const ok = amount != null;
    return { ...l, key: keyOf(l), product, variant, unit: amount, isTest, ok, lineTotal: ok ? amount * l.qty : 0 };
  });
  const payable = priced.filter((l) => l.ok);
  return {
    lines: priced,
    count: cart.reduce((n, l) => n + l.qty, 0),
    subtotal: payable.reduce((n, l) => n + l.lineTotal, 0),
    hasTest: payable.some((l) => l.isTest),
    hasUnavailable: priced.some((l) => !l.ok),
  };
}
