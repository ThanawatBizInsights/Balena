import { useEffect } from "react";
import { inCategory, productHref, products } from "../data/products";
import { Arrow, ProductImg, Shell, accentStyle } from "./ui";

const pouch = products.find((p) => p.slug === "cold-brew-concentrate-smooth-black")!;
const coldBrew = inCategory("cold-brew");
const beans = inCategory("beans");

/** Old home page and trial anchors that now live elsewhere. */
const MOVED: Record<string, string> = {
  "#products": "/products",
  "#coldbrew": "/products#cold-brew",
  "#drinks": "/about#drinks",
  "#story": "/about#story",
  "#buy": "#contact",
  "#beans": "#coffee-beans",
  "#lineup": "/products",
};

export function HomePage() {
  useEffect(() => {
    const follow = () => {
      const to = MOVED[location.hash];
      if (!to) return;
      if (to.startsWith("#")) {
        history.replaceState(null, "", to);
        document.getElementById(to.slice(1))?.scrollIntoView();
      } else location.replace(to);
    };
    follow();
    addEventListener("hashchange", follow);
    return () => removeEventListener("hashchange", follow);
  }, []);

  return (
    <Shell page="home">
      {/* 1. Hero: the pouch in front of an oversized COLD BREW, the approved hooks below. */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__band" aria-hidden="true" />
        <p className="hero__giant" aria-hidden="true" lang="en"><span>COLD</span><span>BREW</span></p>
        <div className="hero__pouch">
          <ProductImg img={pouch.images[0]} eager sizes="(min-width: 900px) 34vw, 70vw" />
        </div>
        <div className="hero__copy">
          <h1 id="hero-title" className="hero__th">ชงง่ายที่บ้าน<br />เข้มอร่อยได้ทุกเมนู</h1>
          <p className="hero__en" lang="en">Your everyday coffee, made at home</p>
          <div className="hero__ctas">
            <a className="btn btn--cream" href="/products#cold-brew">ดูโคลด์บรูว์</a>
            <a className="btn btn--ghost" href="/products#coffee-beans">ดูเมล็ดกาแฟ</a>
          </div>
        </div>
      </section>

      {/* 2. Cold brew */}
      <section className="cat cat--navy" id="cold-brew" aria-labelledby="cb-title">
        <div className="cat__in">
          <div className="cat__head">
            <p className="kicker" lang="en">Cold Brew</p>
            <h2 id="cb-title" className="h-th">โคลด์บรูว์</h2>
            <p className="cat__lead">ถุง 500 มล. พร้อมจุกเท ชงง่ายที่บ้าน</p>
          </div>
          <ul className="pouches">
            {coldBrew.map((p) => (
              <li key={p.slug} style={accentStyle(p)}>
                <article className="pouch-card">
                  <span className="pouch-card__img"><ProductImg img={p.images[0]} sizes="(min-width: 900px) 30vw, 80vw" /></span>
                  <h3 className="pouch-card__name" lang="en">{p.name}</h3>
                  <p className="pouch-card__sub" lang="en">{p.subtitle}</p>
                  <a className="btn btn--cream" href={productHref(p)} aria-label={`ดูรายละเอียดสินค้า ${p.name} ${p.subtitle}`}>
                    ดูรายละเอียดสินค้า
                  </a>
                </article>
              </li>
            ))}
          </ul>
          <div className="cat__more">
            <a className="btn btn--ghost" href="/products#cold-brew">ดูโคลด์บรูว์ <Arrow /></a>
            <a className="linkish linkish--light" href="/cold-brew-recipes/">ดูวิธีชง Cold Brew</a>
          </div>
        </div>
      </section>

      {/* 3. Beans: a shelf of bags, each on its own label colour */}
      <section className="cat cat--cream" id="coffee-beans" aria-labelledby="beans-title">
        <div className="cat__in">
          <div className="cat__head">
            <p className="kicker" lang="en">Coffee Beans</p>
            <h2 id="beans-title" className="h-th">เมล็ดกาแฟคั่ว</h2>
            <p className="cat__lead">{beans.length} รายการ คั่วแบบทั้งเมล็ด (Whole Bean) ขนาด 200 กรัม และ 100 กรัม</p>
          </div>
          <ul className="shelf">
            {beans.map((p) => (
              <li key={p.slug} style={accentStyle(p)}>
                <a href={productHref(p)} className="shelf__item" aria-label={`ดูรายละเอียดสินค้า ${p.name} ${p.size}`}>
                  <span className="shelf__img"><ProductImg img={p.images[0]} sizes="(min-width: 900px) 18vw, 40vw" /></span>
                  <span className="shelf__name" lang="en">{p.name}</span>
                  {p.notes && <span className="shelf__notes" lang="en">{p.notes}</span>}
                  <span className="shelf__size">{p.size}</span>
                  <span className="shelf__more" aria-hidden="true">ดูรายละเอียดสินค้า <Arrow /></span>
                </a>
              </li>
            ))}
          </ul>
          <div className="cat__more">
            <a className="btn btn--navy" href="/products#coffee-beans">ดูเมล็ดกาแฟ <Arrow /></a>
          </div>
        </div>
      </section>

      {/* 4. Brand introduction */}
      <section className="intro" aria-labelledby="intro-title">
        <img className="intro__whale" src="/images/balena-whale-sticker.webp" width={1254} height={1254}
          alt="วาฬ Balena มีถ้วยกาแฟบนหัว" loading="lazy" decoding="async" />
        <div className="intro__text">
          <p className="kicker" lang="en">Big whale. Small batch.</p>
          <h2 id="intro-title" className="h-th">ทำไมต้องวาฬ</h2>
          <p>Balena แปลว่า “วาฬ” ในภาษาอิตาลี สัตว์ตัวใหญ่ที่ใจดีและสบาย&nbsp;ๆ เหมือนกาแฟแก้วที่เราอยากให้คุณ</p>
          <a className="btn btn--navy" href="/about">รู้จักเรา <Arrow /></a>
        </div>
      </section>
    </Shell>
  );
}
