// Small motion helpers for the operations app. Everything respects prefers-reduced-motion:
// counters jump to their value, and the CSS turns animations off (see ops.css, "motion").
import { useEffect, useRef, useState, type ReactNode } from "react";
import { allProducts } from "../data/products";

export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts up to a known value once (600 ms). Unknown values are never animated. */
export function useCountUp(value: number | null, ms = 600) {
  const [shown, setShown] = useState<number | null>(value);
  const from = useRef(0);
  useEffect(() => {
    if (value == null || reducedMotion()) { setShown(value); return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** A number that counts up when it is known; text when it isn't. */
export function Counter({ value, format, missing }: { value: number | null; format: (n: number) => string; missing: ReactNode }) {
  const v = useCountUp(value);
  return <>{value == null || v == null ? missing : format(v)}</>;
}

/**
 * Gives buttons inside `root` a short wiggle when pressed (mouse, touch or keyboard; keyboard
 * activation fires click too). One listener per workspace; nothing loops.
 */
export function useWiggle(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const on = (e: Event) => {
      const b = (e.target as HTMLElement).closest(".btn, .tab, .seg button, .chip-btn");
      if (!b || reducedMotion()) return;
      b.classList.remove("is-wiggle");
      void (b as HTMLElement).offsetWidth;
      b.classList.add("is-wiggle");
      b.addEventListener("animationend", () => b.classList.remove("is-wiggle"), { once: true });
    };
    el.addEventListener("click", on);
    return () => el.removeEventListener("click", on);
  }, [root]);
}

/** A brief "saved" confirmation that fades by itself. */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(id);
  }, [msg]);
  const node = msg ? <p className="toast" role="status"><span aria-hidden="true">✓</span> {msg}</p> : null;
  return { show: setMsg, node };
}

/** The public site's product photo for an operations item, matched through products.ts opsCodes. */
export function productPhoto(code: string | null | undefined): string | null {
  if (!code) return null;
  const p = allProducts.find((x) => x.internal.opsCodes.includes(code));
  const img = p?.images[0];
  return img ? `/images/products/${img.file}-480.webp` : null;
}

export function ProductThumb({ code, alt, size = 44, eager }: { code: string | null | undefined; alt: string; size?: number; eager?: boolean }) {
  const src = productPhoto(code);
  return src
    ? <img className="thumb" src={src} alt={alt} width={size} height={size} loading={eager ? "eager" : "lazy"} decoding="async" />
    : <span className="thumb thumb--none" style={{ width: size, height: size }} aria-hidden="true">☕</span>;
}
