import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, bySlug, products, type Category } from "../data/products";
import { navigate, useTitle } from "../router";
import { BuyPanel } from "../components/BuyPanel";
import { ProductImg, Shell, accentStyle } from "../components/ui";

export function Order({ slug }: { slug: string | null }) {
  useTitle("สั่งซื้อ");
  const initial = (slug && bySlug(slug)) || products[0];
  const [cat, setCat] = useState<Category | "all">("all");
  const [current, setCurrent] = useState(initial);
  const list = useMemo(() => (cat === "all" ? products : products.filter((p) => p.category === cat)), [cat]);
  const strip = useRef<HTMLDivElement>(null);

  // Keep the selection inside the filter, and keep the address shareable.
  useEffect(() => { if (!list.includes(current)) setCurrent(list[0]); }, [list, current]);
  useEffect(() => { history.replaceState(null, "", `/trial/order?p=${current.slug}`); }, [current]);
  useEffect(() => {
    strip.current?.querySelector(`[data-slug="${current.slug}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [current]);

  const idx = list.indexOf(current);
  const step = (d: number) => setCurrent(list[(idx + d + list.length) % list.length]);

  return (
    <Shell tone="light">
      <div className="order" style={accentStyle(current)}>
        <div className="order__top">
          <h1 className="h-th">สั่งซื้อ</h1>
          <div className="pills" role="group" aria-label="หมวดสินค้า">
            {[{ id: "all" as const, th: "ทั้งหมด" }, ...CATEGORIES].map((c) => (
              <button key={c.id} type="button" className={`pill ${cat === c.id ? "is-on" : ""}`} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                {c.th}
              </button>
            ))}
          </div>
        </div>

        <div className="order__strip" ref={strip} role="listbox" aria-label="เลือกสินค้า">
          {list.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected={p === current} data-slug={p.slug}
              className={`chip ${p === current ? "is-on" : ""}`} style={accentStyle(p)} onClick={() => setCurrent(p)}>
              <span className="chip__img"><ProductImg img={p.images[0]} sizes="80px" /></span>
              <span lang="en">{p.name}</span>
            </button>
          ))}
        </div>

        <div className="order__main">
          <div className="order__visual">
            <p className="order__giant" aria-hidden="true" lang="en">{current.name.split(" ")[0].toUpperCase()}</p>
            <div className="order__img" key={current.id}><ProductImg img={current.images[0]} eager sizes="(min-width: 900px) 40vw, 80vw" /></div>
            <div className="order__arrows">
              <button type="button" className="round round--light" onClick={() => step(-1)} aria-label="สินค้าก่อนหน้า">←</button>
              <span>{String(idx + 1).padStart(2, "0")} / {String(list.length).padStart(2, "0")}</span>
              <button type="button" className="round round--light" onClick={() => step(1)} aria-label="สินค้าถัดไป">→</button>
            </div>
          </div>

          <div className="order__panel">
            <p className="order__cat">{current.category === "beans" ? "เมล็ดกาแฟ" : "โคลด์บรูว์"}</p>
            <h2 className="order__name" lang="en">{current.name}</h2>
            <p className="order__sub" lang="en">{current.subtitle}</p>
            <BuyPanel product={current} compact />
            <p className="order__desc">{current.description}</p>
            <ul className="facts">
              {current.attributes.slice(0, 4).map((a) => <li key={a.label}><span>{a.label}</span><b lang="en">{a.value}</b></li>)}
            </ul>
            <button type="button" className="linkish" onClick={() => navigate(`/trial/products/${current.slug}`)}>ดูรายละเอียดทั้งหมด</button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
