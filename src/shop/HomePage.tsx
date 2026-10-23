import { useEffect } from "react";
import { inCategory, productHref, products } from "../data/products";
import { HERO_HOOKS, fill } from "../i18n/shop";
import { Arrow, NoteTags, ProductImg, Shell, SoonBadge, accentStyle, useText } from "./ui";

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
      <HomeBody />
    </Shell>
  );
}

function HomeBody() {
  const t = useText();
  const thai = <span lang="th">{HERO_HOOKS.th[0]}<br />{" "}{HERO_HOOKS.th[1]}</span>;
  const english = <span lang="en">{HERO_HOOKS.en[0]}</span>;
  return (
    <>
      {/* 1. Hero: the pouch in front of an oversized COLD BREW, the approved hook pair below.
          The visitor's language is the headline; the other hook stays as the line under it. */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__band" aria-hidden="true" />
        <p className="hero__giant" aria-hidden="true" lang="en"><span>COLD</span><span>BREW</span></p>
        <div className="hero__pouch">
          <ProductImg img={pouch.images[0]} eager sizes="(min-width: 900px) 34vw, 70vw" />
        </div>
        <div className="hero__copy">
          <h1 id="hero-title" className={t.lang === "en" ? "hero__h hero__h--en" : "hero__h"}>{t.lang === "en" ? english : thai}</h1>
          <p className={t.lang === "en" ? "hero__sub hero__sub--th" : "hero__sub"}>{t.lang === "en" ? thai : english}</p>
          <div className="hero__ctas">
            <a className="btn btn--cream" href="/products#cold-brew">{t.home.seeColdBrew}</a>
            <a className="btn btn--ghost" href="/products#coffee-beans">{t.home.seeBeans}</a>
          </div>
        </div>
      </section>

      {/* 2. Cold brew */}
      <section className="cat cat--navy" id="cold-brew" aria-labelledby="cb-title">
        <div className="cat__in">
          <div className="cat__head">
            <p className="kicker" lang="en">Cold Brew</p>
            <h2 id="cb-title" className="h-th">{t.categories["cold-brew"]}</h2>
            <p className="cat__lead">{t.home.coldBrewLead}</p>
          </div>
          <ul className="pouches">
            {coldBrew.map((p) => (
              <li key={p.slug} style={accentStyle(p)}>
                <article className="pouch-card">
                  <span className="pouch-card__img"><ProductImg img={p.images[0]} sizes="(min-width: 900px) 30vw, 80vw" /></span>
                  <h3 className="pouch-card__name" lang="en">{p.shortName}</h3>
                  <p className="pouch-card__sub" lang="en">{p.name} · {p.size}</p>
                  {p.status === "planned" && <SoonBadge />}
                  <p className="pouch-card__benefit">{p.benefit[t.lang]}</p>
                  <NoteTags product={p} max={3} />
                  <a className="btn btn--cream btn--sm" href={productHref(p)} aria-label={`${t.home.details}: ${p.name} ${p.subtitle}`}>
                    {t.home.detailsShort} <Arrow />
                  </a>
                </article>
              </li>
            ))}
          </ul>
          <div className="cat__more">
            <a className="btn btn--ghost" href="/products#cold-brew">{t.home.seeColdBrew} <Arrow /></a>
            <a className="linkish linkish--light" href="/cold-brew-recipes/">{t.home.recipes}</a>
          </div>
        </div>
      </section>

      {/* 3. Beans: a shelf of bags, each on its own label colour */}
      <section className="cat cat--cream" id="coffee-beans" aria-labelledby="beans-title">
        <div className="cat__in">
          <div className="cat__head">
            <p className="kicker" lang="en">Coffee Beans</p>
            <h2 id="beans-title" className="h-th">{t.categories.beans}</h2>
            <p className="cat__lead">{fill(t.home.beansLead, { count: beans.length.toLocaleString(t.lang) })}</p>
          </div>
          <ul className="shelf">
            {beans.map((p) => (
              <li key={p.slug} style={accentStyle(p)}>
                <a href={productHref(p)} className="shelf__item" aria-label={`${t.home.details}: ${p.name} ${p.size}`}>
                  <span className="shelf__img"><ProductImg img={p.images[0]} sizes="(min-width: 900px) 18vw, 40vw" /></span>
                  <span className="shelf__name" lang="en">{p.name}</span>
                  <span className="shelf__size">{p.size}</span>
                  {p.status === "planned" && <SoonBadge />}
                  <span className="shelf__benefit">{p.benefit[t.lang]}</span>
                  <NoteTags product={p} max={3} />
                  <span className="shelf__more" aria-hidden="true">{t.home.detailsShort} <Arrow /></span>
                </a>
              </li>
            ))}
          </ul>
          <div className="cat__more">
            <a className="btn btn--navy" href="/products#coffee-beans">{t.home.seeBeans} <Arrow /></a>
          </div>
        </div>
      </section>

      {/* 4. Brand introduction */}
      <section className="intro" aria-labelledby="intro-title">
        <img className="intro__whale" src="/images/balena-whale-sticker.webp" width={1254} height={1254}
          alt={t.home.whaleAlt} loading="lazy" decoding="async" />
        <div className="intro__text">
          <p className="intro__slogan">{t.slogan}</p>
          <h2 id="intro-title" className="h-th">{t.home.whyWhale}</h2>
          <p>{t.home.whyWhaleText}</p>
          <a className="btn btn--navy" href="/about">{t.home.aboutCta} <Arrow /></a>
        </div>
      </section>
    </>
  );
}
