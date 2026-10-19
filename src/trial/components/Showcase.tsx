import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Product } from "../data/products";
import { Link } from "../router";
import { priceOf, useTestPrices } from "../state/pricing";
import { PriceTag, ProductImg, accentStyle } from "./ui";

/**
 * Horizontal product gallery: swipe (scroll-snap) on phones, arrow buttons and ←/→ keys on
 * desktop. The item nearest the centre is the active one; its details sit below in its colour.
 */
export function Showcase({ items, title, id }: { items: Product[]; title: string; id: string }) {
  const track = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const testPrices = useTestPrices();
  const p = items[Math.min(active, items.length - 1)];

  const go = useCallback((i: number) => {
    const el = track.current?.children[Math.max(0, Math.min(items.length - 1, i))] as HTMLElement | undefined;
    if (!el || !track.current) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.current.scrollTo({ left: el.offsetLeft - (track.current.clientWidth - el.clientWidth) / 2, behavior: reduce ? "auto" : "smooth" });
    setActive(Math.max(0, Math.min(items.length - 1, i)));
  }, [items.length]);

  // Follow manual swipes: the card closest to the centre becomes active.
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mid = t.scrollLeft + t.clientWidth / 2;
        let best = 0, dist = Infinity;
        [...t.children].forEach((c, i) => {
          const el = c as HTMLElement;
          const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - mid);
          if (d < dist) { dist = d; best = i; }
        });
        setActive(best);
      });
    };
    t.addEventListener("scroll", onScroll, { passive: true });
    return () => { t.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
  };
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="show" id={id} aria-labelledby={`${id}-title`} style={accentStyle(p)}>
      <div className="show__head">
        <div>
          <p className="kicker" lang="en">The lineup · swipe</p>
          <h2 id={`${id}-title`} className="h-th">{title}</h2>
        </div>
        <div className="show__nav">
          <span className="show__count" aria-live="polite"><b>{pad(active + 1)}</b> / {pad(items.length)}</span>
          <button type="button" className="round" onClick={() => go(active - 1)} disabled={active === 0} aria-label="สินค้าก่อนหน้า">←</button>
          <button type="button" className="round" onClick={() => go(active + 1)} disabled={active === items.length - 1} aria-label="สินค้าถัดไป">→</button>
        </div>
      </div>

      <ol className="show__track" ref={track} tabIndex={0} onKeyDown={onKey} aria-label={`${title} เลื่อนดูด้วยปุ่มลูกศรซ้ายขวา`}>
        {items.map((it, i) => (
          <li key={it.id} className={`show__item ${i === active ? "is-active" : ""}`} style={accentStyle(it)}>
            <button type="button" className="show__pick" onClick={() => go(i)} aria-pressed={i === active} aria-label={`${it.name} ${it.subtitle}`}>
              <span className="show__num" aria-hidden="true">{pad(i + 1)}</span>
              <span className="show__disc" aria-hidden="true" />
              <ProductImg img={it.images[0]} sizes="(min-width: 900px) 22vw, 55vw" />
              <span className="show__name" lang="en">{it.name}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="show__progress" aria-hidden="true"><span style={{ width: `${((active + 1) / items.length) * 100}%` }} /></div>

      <div className="show__detail" key={p.id}>
        <div>
          <p className="show__cat">{p.category === "beans" ? "เมล็ดกาแฟ" : "โคลด์บรูว์"}</p>
          <h3 className="show__title" lang="en">{p.name}</h3>
          <p className="show__sub" lang="en">{p.subtitle}</p>
          <p className="show__notes">{p.attributes.find((a) => a.label === "Taste notes")?.value ?? p.description}</p>
        </div>
        <div className="show__buy">
          <PriceTag info={priceOf(p.variants[0], testPrices)} big />
          <div className="show__actions">
            <Link to={`/trial/products/${p.slug}`} className="btn btn--light">ดูรายละเอียด</Link>
            <Link to={`/trial/order?p=${p.slug}`} className="btn btn--accent">
              {priceOf(p.variants[0], testPrices).amount != null ? "สั่งซื้อ" : "ดูตัวเลือก"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
