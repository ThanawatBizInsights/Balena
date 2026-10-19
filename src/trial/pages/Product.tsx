import { useState } from "react";
import { bySlug, products } from "../data/products";
import { Link, useTitle } from "../router";
import { BuyPanel } from "../components/BuyPanel";
import { ProductImg, Shell, accentStyle } from "../components/ui";
import { NotFound } from "./NotFound";

export function ProductPage({ slug }: { slug: string }) {
  const p = bySlug(slug);
  useTitle(p ? p.name : "ไม่พบสินค้า");
  const [img, setImg] = useState(0);
  if (!p) return <NotFound />;
  const image = p.images[Math.min(img, p.images.length - 1)];
  const related = products.filter((o) => o.category === p.category && o.id !== p.id).slice(0, 4);

  return (
    <Shell tone="light">
      <article className="pdp" style={accentStyle(p)} key={p.id}>
        <nav className="crumbs" aria-label="ตำแหน่ง">
          <Link to="/trial">หน้าแรก</Link><span aria-hidden="true">/</span>
          <Link to={`/trial/order?p=${p.slug}`}>{p.category === "beans" ? "เมล็ดกาแฟ" : "โคลด์บรูว์"}</Link><span aria-hidden="true">/</span>
          <span aria-current="page" lang="en">{p.name}</span>
        </nav>
        <div className="pdp__grid">
          <div className="pdp__visual">
            <div className="pdp__img"><ProductImg img={image} eager sizes="(min-width: 900px) 45vw, 90vw" /></div>
            {p.images.length > 1 && (
              <div className="pdp__thumbs" role="group" aria-label="รูปสินค้า">
                {p.images.map((im, i) => (
                  <button key={im.file} type="button" className={i === img ? "is-on" : ""} aria-pressed={i === img} onClick={() => setImg(i)} aria-label={`รูปที่ ${i + 1}`}>
                    <ProductImg img={im} sizes="72px" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="pdp__info">
            <p className="order__cat">{p.category === "beans" ? "เมล็ดกาแฟ" : "โคลด์บรูว์"}</p>
            <h1 className="pdp__name" lang="en">{p.name}</h1>
            <p className="order__sub" lang="en">{p.subtitle}</p>
            <p className="pdp__desc">{p.description}</p>
            <BuyPanel product={p} />
            <h2 className="pdp__h">รายละเอียดจากฉลาก</h2>
            <dl className="specs">
              {p.attributes.map((a) => (<div key={a.label}><dt>{a.label}</dt><dd lang="en">{a.value}</dd></div>))}
            </dl>
          </div>
        </div>

        <section className="related" aria-labelledby="rel-title">
          <h2 id="rel-title" className="h-th">ดูตัวอื่นต่อ</h2>
          <ul className="shelf shelf--small">
            {related.map((o) => (
              <li key={o.id} style={accentStyle(o)}>
                <Link to={`/trial/products/${o.slug}`} className="shelf__item">
                  <span className="shelf__img"><ProductImg img={o.images[0]} sizes="(min-width: 900px) 18vw, 40vw" /></span>
                  <span className="shelf__name" lang="en">{o.name}</span>
                  <span className="shelf__size">{o.variants.map((v) => v.label).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/trial/order" className="btn btn--navy">กลับไปเลือกสินค้า</Link>
        </section>
      </article>
    </Shell>
  );
}
