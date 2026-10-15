import { Fragment, useEffect, useState, type ReactNode } from "react";
import { assetUrl, site } from "../config/site";
import { text, type Lang } from "./i18n";

const LANG_KEY = "balena-lang";

const img = {
  welcome: { src: "images/balena-welcome.webp", width: 1254, height: 1254 },
  banner: { src: "images/balena-banner.webp", width: 2000, height: 667 },
  drinks: { src: "images/balena-signature-drinks.webp", width: 1254, height: 1254 },
  sticker: { src: "images/balena-whale-sticker.webp", width: 1254, height: 1254 },
};

const RECIPES_URL = "/cold-brew-recipes/";

export function HomeApp() {
  // The pre-rendered HTML is Thai; a saved English choice switches after load.
  const [lang, setLang] = useState<Lang>("th");
  const t = text[lang];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "en" || saved === "th") setLang(saved);
    } catch {
      // Storage blocked: stay in Thai.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.meta.description);
  }, [lang, t]);

  const choose = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      // Not saved; the choice still applies for this visit.
    }
  };

  return (
    <div className={`home lang-${lang}`}>
      <Hero lang={lang} choose={choose} />
      <main>
        <Products lang={lang} />
        <Drinks lang={lang} />
        <Story lang={lang} />
        <Buy lang={lang} />
      </main>
      <Footer lang={lang} />
    </div>
  );
}

/* ---------- hero: deep-sea panel with the menu inside and a floating product card ---------- */

function Hero({ lang, choose }: { lang: Lang; choose: (l: Lang) => void }) {
  const t = text[lang];
  const [open, setOpen] = useState(false);
  const links = [
    { href: "#products", label: t.nav.products },
    { href: "#drinks", label: t.nav.drinks },
    { href: "#story", label: t.nav.story },
    { href: RECIPES_URL, label: t.nav.recipes },
    { href: "#buy", label: t.nav.buy },
  ];

  return (
    <header className="hero-wrap">
      <div className="hero">
        <Waves />
        <Bubbles />
        <nav className="nav" aria-label={t.nav.menu}>
          <a className="nav__brand" href="/">
            <Spout />
            <span>
              Balena <small>Roastery</small>
            </span>
          </a>
          <ul className={`nav__links${open ? " is-open" : ""}`} id="nav-links">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="nav__tools">
            <LangSwitch lang={lang} choose={choose} label={t.nav.language} />
            <button
              type="button"
              className="nav__toggle"
              aria-expanded={open}
              aria-controls="nav-links"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? t.nav.close : t.nav.menu}
            </button>
          </div>
        </nav>

        <div className="hero__body">
          <div className="hero__text">
            <p className="hero__tagline">Big whale. Small batch.</p>
            <h1 className="hero__title">
              {t.hero.title.map((part, i) => (
                <Fragment key={part}>
                  {i > 0 && " "}
                  <span>{part}</span>
                </Fragment>
              ))}
            </h1>
            <p className="hero__lead">{t.hero.lead}</p>
            <div className="hero__actions">
              <a className="pill pill--spray" href="#products">
                {t.hero.cta} <Arrow />
              </a>
              <a className="pill pill--ghost" href={RECIPES_URL}>
                {t.hero.secondary}
              </a>
            </div>
          </div>

          <article className="card" aria-labelledby="card-title">
            <img
              className="card__sticker"
              src={assetUrl(img.sticker.src)}
              width={img.sticker.width}
              height={img.sticker.height}
              alt={t.alt.sticker}
              decoding="async"
            />
            <div className="card__photo">
              <img
                src={assetUrl(img.welcome.src)}
                width={img.welcome.width}
                height={img.welcome.height}
                alt={t.alt.welcome}
                fetchPriority="high"
                decoding="async"
              />
            </div>
            <div className="card__body">
              <p className="card__tag">{t.card.tag}</p>
              <h2 className="card__name" id="card-title">{t.card.name}</h2>
              <p className="card__text">{t.card.text}</p>
              <div className="card__actions">
                <OrderButton href={site.links.order} label={t.card.order} soon={t.card.soon} />
                <a className="round" href="#coldbrew" aria-label={t.card.details}>
                  <Arrow />
                </a>
              </div>
            </div>
          </article>
        </div>
      </div>
    </header>
  );
}

function LangSwitch({ lang, choose, label }: { lang: Lang; choose: (l: Lang) => void; label: string }) {
  return (
    <div className="lang" role="group" aria-label={label}>
      {(["th", "en"] as const).map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => choose(l)}>
          {l === "th" ? "ไทย" : "EN"}
        </button>
      ))}
    </div>
  );
}

function OrderButton({ href, label, soon }: { href: string; label: string; soon: string }) {
  if (!href) {
    return (
      <span className="pill pill--blue is-disabled" aria-disabled="true">
        {soon}
      </span>
    );
  }
  return (
    <a className="pill pill--blue" href={href} target="_blank" rel="noopener noreferrer">
      {label} <Arrow />
    </a>
  );
}

/* ---------- products ---------- */

function Products({ lang }: { lang: Lang }) {
  const t = text[lang].products;
  return (
    <section id="products" className="section" aria-labelledby="products-title">
      <SectionHead id="products-title" title={t.title} lead={t.lead} />
      <div className="products">
        <article id="coldbrew" className="product product--wide">
          <div className="product__photo">
            <img
              src={assetUrl(img.banner.src)}
              width={img.banner.width}
              height={img.banner.height}
              alt={text[lang].alt.banner}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="product__body">
            <h3 className="product__name">
              {t.coldbrew.name} <span className="product__size">{t.coldbrew.size}</span>
            </h3>
            <p>{t.coldbrew.text}</p>
            <ul className="ticks">
              {t.coldbrew.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="product__actions">
              <a className="pill pill--blue" href={RECIPES_URL}>
                {t.coldbrew.recipes} <Arrow />
              </a>
              <OrderButton href={site.links.order} label={text[lang].card.order} soon={text[lang].card.soon} />
            </div>
          </div>
        </article>

        <article className="product product--beans">
          <BeansArt />
          <div className="product__body">
            <h3 className="product__name">{t.beans.name}</h3>
            <p>{t.beans.text}</p>
            <p className="product__soon">{t.beans.soon}</p>
          </div>
        </article>
      </div>
    </section>
  );
}

/* ---------- signature drinks ---------- */

function Drinks({ lang }: { lang: Lang }) {
  const t = text[lang].drinks;
  return (
    <section id="drinks" className="section drinks" aria-labelledby="drinks-title">
      <div className="drinks__grid">
        <div className="drinks__photo">
          <img
            src={assetUrl(img.drinks.src)}
            width={img.drinks.width}
            height={img.drinks.height}
            alt={t.alt}
            loading="lazy"
            decoding="async"
          />
        </div>
        <div>
          <SectionHead id="drinks-title" title={t.title} lead={t.lead} />
          <ol className="drinks__list">
            {t.items.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ol>
          <p className="drinks__home">
            {t.home}{" "}
            <a href={RECIPES_URL}>
              {t.homeLink} <Arrow />
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- story ---------- */

function Story({ lang }: { lang: Lang }) {
  const t = text[lang].story;
  return (
    <section id="story" className="section story" aria-labelledby="story-title">
      <img
        className="story__sticker"
        src={assetUrl(img.sticker.src)}
        width={img.sticker.width}
        height={img.sticker.height}
        alt={text[lang].alt.sticker}
        loading="lazy"
        decoding="async"
      />
      <div>
        <h2 id="story-title" className="section__title">{t.title}</h2>
        <p className="story__p">{t.p1}</p>
        <p className="story__p">{t.p2}</p>
        <p className="story__sign" lang="en">{t.sign}</p>
      </div>
    </section>
  );
}

/* ---------- where to buy ---------- */

const CHANNELS: { key: keyof typeof site.channels; name: string; icon: ReactNode }[] = [
  { key: "lineOA", name: "LINE OA", icon: <ChatIcon /> },
  { key: "lineShop", name: "LINE SHOPPING", icon: <BagIcon /> },
  { key: "shopee", name: "Shopee", icon: <BagIcon /> },
  { key: "facebook", name: "Facebook", icon: <ChatIcon /> },
];

function Buy({ lang }: { lang: Lang }) {
  const t = text[lang].buy;
  return (
    <section id="buy" className="section" aria-labelledby="buy-title">
      <SectionHead id="buy-title" title={t.title} lead={t.lead} />
      <ul className="channels">
        {CHANNELS.map((c) => {
          const href = site.channels[c.key];
          const inner = (
            <>
              <span className="channel__icon" aria-hidden="true">{c.icon}</span>
              <span className="channel__name">{c.name}</span>
              <span className="channel__state">{href ? t.open : t.soon}</span>
            </>
          );
          return (
            <li key={c.key}>
              {href ? (
                <a className="channel" href={href} target="_blank" rel="noopener noreferrer">
                  {inner}
                </a>
              ) : (
                <span className="channel is-disabled" aria-disabled="true">{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Footer({ lang }: { lang: Lang }) {
  const t = text[lang].footer;
  return (
    <footer className="foot">
      <div className="foot__inner">
        <p className="foot__brand">
          Balena <small>Roastery</small>
        </p>
        <p className="foot__tag" lang="en">{t.tagline}</p>
        <a href={RECIPES_URL}>{t.recipes}</a>
        <p className="foot__small">© {new Date().getFullYear()} Balena Roastery · {t.rights}</p>
      </div>
    </footer>
  );
}

function SectionHead({ id, title, lead }: { id: string; title: string; lead: string }) {
  return (
    <div className="section__head">
      <h2 id={id} className="section__title">{title}</h2>
      <p className="section__lead">{lead}</p>
    </div>
  );
}

/* ---------- small drawings (no brand artwork is redrawn) ---------- */

function Arrow() {
  return (
    <svg className="arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 12 L12 4 M6 4 H12 V10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spout() {
  return (
    <svg className="nav__spout" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <path d="M15 17 C 13 11, 8 8, 4 9 C 8 10, 11 13, 13 18 Z" fill="currentColor" />
      <path d="M15 17 C 17 11, 22 8, 26 9 C 22 10, 19 13, 17 18 Z" fill="currentColor" />
      <circle cx="15" cy="24" r="3" fill="currentColor" />
    </svg>
  );
}

function Waves() {
  return (
    <svg className="hero__waves" viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M0 ${220 + i * 46} C 200 ${180 + i * 46}, 400 ${260 + i * 46}, 600 ${220 + i * 46} S 1000 ${180 + i * 46}, 1200 ${220 + i * 46}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity={0.18 - i * 0.03}
        />
      ))}
    </svg>
  );
}

/** Air bubbles rising through the deep-sea panel (static, decorative). */
function Bubbles() {
  const bubbles = [
    [6, 34, 18], [14, 22, 9], [24, 40, 12], [33, 16, 7], [42, 30, 15], [52, 12, 8], [60, 36, 10],
  ];
  return (
    <svg className="hero__bubbles" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {bubbles.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r / 10} fill="none" stroke="currentColor" strokeWidth="0.18" />
          <circle cx={x - r / 30} cy={y - r / 30} r={r / 40} fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

function BeansArt() {
  const beans = [
    [70, 70, -25], [120, 52, 20], [168, 80, -10], [92, 118, 35], [146, 128, -40], [196, 132, 15], [50, 140, 10],
  ];
  return (
    <svg className="product__beans" viewBox="0 0 240 180" aria-hidden="true">
      {beans.map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <ellipse rx="26" ry="18" fill="#4A2614" />
          <path d="M -20 0 C -8 -9, 8 9, 20 0" stroke="#2A140A" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      <path d="M13 4 C 7 4, 3 8, 3 12.5 C 3 17, 7 20.5, 12 21 L 11 24 L 16 20.5 C 20 19.5, 23 16.5, 23 12.5 C 23 8, 19 4, 13 4 Z" fill="currentColor" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      <path d="M5 9 H21 L20 23 H6 Z" fill="currentColor" />
      <path d="M9 9 V7 A4 4 0 0 1 17 7 V9" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
