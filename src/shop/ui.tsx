import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Product, ProductImage } from "../data/products";
import { setLang, useDocumentLang, useLang, type Lang } from "../i18n/lang";
import { shopText, type ShopText } from "../i18n/shop";
import { CHANNEL_LOGOS } from "../config/purchase-links";
import { STAFF_OPS_URL } from "../config/site";
import { linksFor } from "./channels";

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

/**
 * Compact purchase/contact buttons for every page except /shop (which has its own two-line
 * channel rows): [small official logo] [platform name], one line each, wrapping as whole
 * buttons. Product links win over store links (see channels.ts).
 */
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
            const logo = CHANNEL_LOGOS[l.id];
            return (
              <li key={l.id}>
                <a className={`buy__btn is-${l.id}`} href={l.href} target="_blank" rel="noopener noreferrer"
                  aria-label={`${c.action}: ${label} (${t.common.newTab})`}>
                  {logo && (
                    <span className="buy__icon" aria-hidden="true">
                      <img src={logo.src} width={logo.width} height={logo.height} alt="" loading="lazy" decoding="async" />
                    </span>
                  )}
                  <span className="buy__name" lang="en">{c.name}</span>
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

/** `contact={false}` on /shop, whose own channel list is the #contact section. */
export function Footer({ contact = true }: { contact?: boolean }) {
  const t = useText();
  return (
    <>
      {contact && <Contact />}
      <footer className="ftr">
        <div className="ftr__in">
          <div className="ftr__brand">
            <Wordmark light />
            <p className="ftr__tag" lang="en">Good Coffee. Brighter Days.</p>
            <p className="ftr__small">{t.slogan}</p>
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
        <div className="ftr__copy">
          <p>© {new Date().getFullYear()} Balena Roastery · {t.footer.rights}</p>
          <a className="ftr__staff" href={STAFF_OPS_URL} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
            </svg>
            {t.footer.staff}
          </a>
        </div>
      </footer>
    </>
  );
}

export function Shell({ page, children, tone = "dark" }: { page: Page; children: ReactNode; tone?: "dark" | "light" }) {
  const contact = page !== "shop";
  const t = useText();
  useDocumentLang(t.lang, t.meta[page]);
  return (
    <div className={`site lang-${t.lang}`}>
      <a className="skip" href="#main">{t.common.skip}</a>
      <Header page={page} tone={tone} />
      <main id="main">{children}</main>
      <Footer contact={contact} />
    </div>
  );
}
