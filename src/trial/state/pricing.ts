// Prices shown in the trial. Real prices come only from products.ts (null until confirmed).
//
// "ราคาทดสอบ" review mode lets the owner walk through cart and demo checkout before prices
// exist: every unpriced item gets the same obviously fake ฿100, badged on screen. It is off
// by default, kept per browser tab (sessionStorage), and switched on with ?test-prices=1 or
// the switch in the trial footer.
import { useSyncExternalStore } from "react";
import type { Variant } from "../data/products";

const KEY = "balena-trial-test-prices";
export const TEST_PRICE = 10000; // satang = ฿100

let on = false;
try {
  const q = new URLSearchParams(location.search).get("test-prices");
  if (q === "1") sessionStorage.setItem(KEY, "1");
  if (q === "0") sessionStorage.removeItem(KEY);
  on = sessionStorage.getItem(KEY) === "1";
} catch {
  // Storage blocked: review mode stays off.
}
const listeners = new Set<() => void>();

export function setTestPrices(next: boolean) {
  on = next;
  try {
    if (next) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {
    // Not remembered; still applies until reload.
  }
  listeners.forEach((l) => l());
}

export function useTestPrices(): boolean {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => on, () => false);
}

export type PriceInfo = { amount: number | null; isTest: boolean };

/** The price to show and charge for a variant (satang), or null when it can't be bought. */
export function priceOf(v: Variant | null, testPrices: boolean): PriceInfo {
  if (!v || !v.available) return { amount: null, isTest: false };
  if (v.price != null) return { amount: v.price, isTest: false };
  return testPrices ? { amount: TEST_PRICE, isTest: true } : { amount: null, isTest: false };
}

export function baht(satang: number): string {
  const whole = satang / 100;
  return "฿" + whole.toLocaleString("th-TH", { minimumFractionDigits: satang % 100 ? 2 : 0, maximumFractionDigits: 2 });
}
