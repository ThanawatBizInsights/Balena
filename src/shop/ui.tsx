import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Product, ProductImage } from "../data/products";
import { setLang, useDocumentLang, useLang, type Lang } from "../i18n/lang";
import { shopText, type ShopText } from "../i18n/shop";
import { linksFor, type ResolvedLink } from "./channels";

export type Page = "home" | "products" | "shop" | "about" | "notFound";

/** The shop text in the visitor's language. */
export function useText(): ShopText & { lang: Lang } {
  const lang = useLang();
  return { ...shopText[lang], lang };
}

/* ---------- product image: responsive webp, keeps proportions, survives a missing file ---------- */

export function ProductImg({ img, sizes = "(min-width: 900px) 40vw, 80vw", eager = false, className }: {
  img: ProductImage; sizes?: string; eager?: boolean; className?: string;
}) {
  const t = useText();
  const [failed, setFailed] = useState(false);
  const alt = img.alt[t.lang];
  if (failed) {
    return <div className={`img-missing ${className ?? ""}`} role="img" aria-label={alt}><span>{t.common.imageMissing}</span></div>;
  }
  const base = `/images/products/${img.file}`;
  return (
    <img
      className={`${img.cutout ? "is-cutout" : "is-photo"} ${className ?? ""}`}
      src={`${base}-960.webp`}
      srcSet={`${base}-480.webp 480w, ${base}-960.webp 960w`}
      sizes={sizes}
      width={img.width}
      height={img.height}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/** Text colour that stays readable on a product's accent colour. */
export function onAccent(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.3 ? "#10172a" : "#ffffff";
}
export const accentStyle = (p: Product) => ({ "--accent": p.accent, "--on-accent": onAccent(p.accent) }) as CSSProperties;

export function Arrow() {
  return (
    <svg className="arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 12 L12 4 M6 4 H12 V10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- purchase buttons (external marketplaces and chats) ---------- */

function ChannelIcon({ id }: { id: ResolvedLink["id"] }) {
  // Plain shapes, not the platforms' logos: a bag for shops, a speech bubble for chats.
  return id === "lineOA" || id === "facebook" ? (
    <svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M13 4 C 7 4, 3 8, 3 12.5 C 3 17, 7 20.5, 12 21 L 11 24 L 16 20.5 C 20 19.5, 23 16.5, 23 12.5 C 23 8, 19 4, 13 4 Z" fill="currentColor" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M5 9 H21 L20 23 H6 Z" fill="currentColor" />
      <path d="M9 9 V7 A4 4 0 0 1 17 7 V9" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Buttons for every channel that has a real link. No link at all: one short line instead. */
export function PurchaseLinks({ product, heading }: { product?: Product; heading: string }) {
  const t = useText();
  const links = linksFor(product?.slug);
  const label = product ? `${product.name} ${product.subtitle}` : "Balena Roastery";
  return (
    <div className="buy">
      <p className="buy__h">{heading}</p>
      {links.length === 0 ? (
        <p className="buy__soon">{t.buy.none}</p>
      ) : (
        <ul className="buy__list">
          {links.map((l) => {
            const c = t.buy.channels[l.id];
            return (
              <li key={l.id}>
                <a className={`buy__btn is-${l.id}`} href={l.href} target="_blank" rel="noopener noreferrer"
                  aria-label={`${c.action}: ${label} (${t.common.newTab})`}>
                  <ChannelIcon id={l.id} />
                  <span><b>{c.action}</b><small>{c.hint}</small></span>
                  <Arrow />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- header, language switch, contact band, footer ---------- */

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={`wordmark ${light ? "is-light" : ""}`} lang="en">
      Balena<small>Roastery</small>
    </span>
  );
}

/** TH / EN switch. Changes the language in place, so the address (product, section) stays. */
export function LangSwitch() {
  const t = useText();
  return (
    <div className="lang" role="group" aria-label={t.common.language}>
      {(["th", "en"] as const).map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={t.lang === l} onClick={() => setLang(l)}
          aria-label={l === "th" ? "ภาษาไทย" : "English"}>
          {l === "th" ? "TH" : "EN"}
        </button>
      ))}
    </div>
  );
}

const NAV: { key: keyof ShopText["nav"]; href: string; page?: Page }[] = [
  { key: "home", href: "/", page: "home" },
  { key: "products", href: "/products", page: "products" },
  { key: "shop", href: "/shop", page: "shop" },
  { key: "about", href: "/about", page: "about" },
  { key: "contact", href: "#contact" },
];

export function Header({ page, tone = "dark" }: { page: Page; tone?: "dark" | "light" }) {
  const t = useText();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <header className={`hdr is-${tone}`}>
      <div className="hdr__in">
        <a href="/" className="hdr__brand" aria-label={t.common.home}><Wordmark light={tone === "dark"} /></a>
        <nav aria-label={t.common.mainMenu} className={`hdr__nav ${open ? "is-open" : ""}`} id="site-nav">
          {NAV.map((n) => (
            <a key={n.key} href={n.href} aria-current={n.page === page ? "page" : undefined} onClick={() => setOpen(false)}>
              {t.nav[n.key]}
            </a>
          ))}
        </nav>
        <div className="hdr__tools">
          <LangSwitch />
          <button type="button" className="hdr__menu" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((o) => !o)}>
            {open ? t.common.close : t.common.menu}
          </button>
        </div>
      </div>
    </header>
  );
}

function Contact() {
  const t = useText();
  return (
    <section className="contact" id="contact" aria-labelledby="contact-title">
      <div className="contact__in">
        <div>
          <p className="kicker" lang="en">Contact</p>
          <h2 id="contact-title" className="h-th">{t.contact.title}</h2>
          <p className="contact__lead">{t.contact.lead}</p>
          <a className="linkish" href="/shop">{t.contact.all} <Arrow /></a>
        </div>
        <PurchaseLinks heading={t.buy.headingContact} />
      </div>
    </section>
  );
}

export function Footer() {
  const t = useText();
  return (
    <>
      <Contact />
      <footer className="ftr">
        <div className="ftr__in">
          <div className="ftr__brand">
            <Wordmark light />
            <p className="ftr__tag" lang="en">Good Coffee. Brighter Days.</p>
            <p className="ftr__small" lang="en">Big whale. Small batch.</p>
          </div>
          <nav className="ftr__col" aria-label={t.footer.products}>
            <p className="ftr__h">{t.footer.products}</p>
            <a href="/products#cold-brew">{t.categories["cold-brew"]}</a>
            <a href="/products#coffee-beans">{t.categories.beans}</a>
            <a href="/cold-brew-recipes/">{t.footer.recipes}</a>
          </nav>
          <nav className="ftr__col" aria-label="Balena Roastery">
            <p className="ftr__h" lang="en">Balena</p>
            <a href="/">{t.nav.home}</a>
            <a href="/shop">{t.nav.shop}</a>
            <a href="/about">{t.nav.about}</a>
            <a href="#contact">{t.nav.contact}</a>
          </nav>
        </div>
        <p className="ftr__copy">© {new Date().getFullYear()} Balena Roastery · {t.footer.rights}</p>
      </footer>
    </>
  );
}

export function Shell({ page, children, tone = "dark" }: { page: Page; children: ReactNode; tone?: "dark" | "light" }) {
  const t = useText();
  useDocumentLang(t.lang, t.meta[page]);
  return (
    <div className={`site lang-${t.lang}`}>
      <a className="skip" href="#main">{t.common.skip}</a>
      <Header page={page} tone={tone} />
      <main id="main">{children}</main>
      <Footer />
    </div>
  );
}
