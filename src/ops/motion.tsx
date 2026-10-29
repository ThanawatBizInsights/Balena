// Small motion helpers for the operations app. Everything respects prefers-reduced-motion:
// counters jump to their value, and the CSS turns animations off (see ops.css, "motion").
import { useEffect, useRef, useState, type ReactNode } from "react";
import { allProducts } from "../data/products";

export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));

/** True once the element has scrolled into view (immediately when motion is reduced or unsupported). */
export function useInView<T extends Element>(ref: React.RefObject<T | null>) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (reducedMotion() || typeof IntersectionObserver !== "function") { setSeen(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

/** Counts up from 0 (or the last value) to a known value once it is visible. Unknown values are never animated. */
export function useCountUp(value: number | null, run: boolean, ms = 900) {
  const animate = value != null && !reducedMotion();
  const [shown, setShown] = useState<number | null>(animate ? 0 : value);
  const from = useRef(0);
  useEffect(() => {
    if (value == null || !animate) { setShown(value); return; }
    if (!run) return;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setShown(a + (value - a) * easeOutExpo(p));
      if (p < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, run, animate]);
  return shown;
}

/** A number that counts up when it is known and on screen; text when it isn't. Screen readers get the final value. */
export function Counter({ value, format, missing }: { value: number | null; format: (n: number) => string; missing: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref);
  const v = useCountUp(value, seen);
  if (value == null || v == null) return <>{missing}</>;
  return (
    <span ref={ref} className="counter">
      <span aria-hidden="true">{format(v)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

/**
 * Plays each `[data-reveal]` block's entrance (cards, chart growth) when it scrolls into view, so
 * charts below the fold don't finish before anyone sees them. CSS keeps them paused until then.
 */
export function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const instant = reducedMotion() || typeof IntersectionObserver !== "function";
    const io = instant ? null : new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io!.unobserve(e.target); }
    }), { threshold: 0.15 });
    const seen = new WeakSet<Element>();
    // Blocks appear after their data loads (and again after a replay), so keep watching for new ones.
    const scan = () => el.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)").forEach((b) => {
      if (seen.has(b)) return;
      seen.add(b);
      if (io) io.observe(b); else b.classList.add("is-in");
    });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(el, { childList: true, subtree: true });
    // Belt and braces: never leave a block hidden. Reveal anything on or above the screen on
    // scroll, and everything after a few seconds whatever happens.
    const check = () => el.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)").forEach((b) => {
      if (b.getBoundingClientRect().top < innerHeight) b.classList.add("is-in");
    });
    addEventListener("scroll", check, { passive: true });
    const late = setTimeout(() => el.querySelectorAll("[data-reveal]").forEach((b) => b.classList.add("is-in")), 5000);
    return () => { mo.disconnect(); io?.disconnect(); removeEventListener("scroll", check); clearTimeout(late); };
  }, [root]);
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
