// The last demo order, kept in memory only (gone on reload). Nothing is sent anywhere.
import type { PricedLine } from "./cart";

export type DemoOrder = {
  ref: string;
  lines: { name: string; subtitle: string; variant: string; qty: number; unit: number; lineTotal: number; isTest: boolean; image: PricedLine["product"] }[];
  subtotal: number;
  count: number;
  hasTest: boolean;
};

let last: DemoOrder | null = null;
export const setDemoOrder = (o: DemoOrder) => { last = o; };
export const getDemoOrder = () => last;

export function demoRef(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return `DEMO-${String(n[0] % 1000000).padStart(6, "0")}`;
}
