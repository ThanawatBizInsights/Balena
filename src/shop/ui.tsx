import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Product, ProductImage } from "../data/products";
import { NO_CHANNELS, linksFor, type ResolvedLink } from "./channels";

export type Page = "home" | "products" | "about";
export type Lang = "th" | "en";

/* ---------- product image: responsive webp, keeps proportions, survives a missing file ---------- */

export function ProductImg({ img, sizes = "(min-width: 900px) 40vw, 80vw", eager = false, className }: {
  img: ProductImage; sizes?: string; eager?: boolean; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className={`img-missing ${className ?? ""}`} role="img" aria-label={img.alt}><span>ไม่พบรูป</span></div>;
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
      alt={img.alt}
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
export function PurchaseLinks({ product, heading = "ช่องทางสั่งซื้อ" }: { product?: Product; heading?: string }) {
  const links = linksFor(product?.slug);
  const label = product ? `${product.name} ${product.subtitle}` : "Balena Roastery";
  return (
    <div className="buy">
      <p className="buy__h">{heading}</p>
      {links.length === 0 ? (
        <p className="buy__soon">{NO_CHANNELS}</p>
      ) : (
        <ul className="buy__list">
          {links.map((l) => (
            <li key={l.id}>
              <a className={`buy__btn is-${l.id}`} href={l.href} target="_blank" rel="noopener noreferrer"
                aria-label={`${l.action}: ${label} (เปิดในแท็บใหม่)`}>
                <ChannelIcon id={l.id} />
                <span><b>{l.action}</b><small>{l.hint}</small></span>
                <Arrow />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- header, contact band, footer ---------- */

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={`wordmark ${light ? "is-light" : ""}`}>
      Balena<small>Roastery</small>
    </span>
  );
}

const NAV: { page: Page | "contact"; href: string; th: string; en: string }[] = [
  { page: "home", href: "/", th: "หน้าแรก", en: "Home" },
  { page: "products", href: "/products", th: "สินค้าของเรา", en: "Our products" },
  { page: "about", href: "/about", th: "รู้จักเรา", en: "About us" },
  { page: "contact", href: "#contact", th: "ติดต่อเรา", en: "Contact" },
];

export function Header({ page, tone = "dark", lang = "th", tools }: { page: Page; tone?: "dark" | "light"; lang?: Lang; tools?: ReactNode }) {
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
        <a href="/" className="hdr__brand" aria-label="Balena Roastery หน้าแรก"><Wordmark light={tone === "dark"} /></a>
        <nav aria-label={lang === "en" ? "Main menu" : "เมนูหลัก"} className={`hdr__nav ${open ? "is-open" : ""}`} id="site-nav">
          {NAV.map((n) => (
            <a key={n.page} href={n.href} aria-current={n.page === page ? "page" : undefined} onClick={() => setOpen(false)}>
              {n[lang]}
            </a>
          ))}
        </nav>
        <div className="hdr__tools">
          {tools}
          <button type="button" className="hdr__menu" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((o) => !o)}>
            {open ? (lang === "en" ? "Close" : "ปิด") : (lang === "en" ? "Menu" : "เมนู")}
          </button>
        </div>
      </div>
    </header>
  );
}

function Contact() {
  return (
    <section className="contact" id="contact" aria-labelledby="contact-title">
      <div className="contact__in">
        <div>
          <p className="kicker" lang="en">Contact</p>
          <h2 id="contact-title" className="h-th">ติดต่อเรา</h2>
          <p className="contact__lead">สั่งซื้อหรือสอบถามผ่านช่องทางที่สะดวก</p>
        </div>
        <PurchaseLinks heading="ช่องทางสั่งซื้อและติดต่อ" />
      </div>
    </section>
  );
}

export function Footer() {
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
          <nav className="ftr__col" aria-label="สินค้า">
            <p className="ftr__h">สินค้า</p>
            <a href="/products#cold-brew">โคลด์บรูว์</a>
            <a href="/products#coffee-beans">เมล็ดกาแฟคั่ว</a>
            <a href="/cold-brew-recipes/">วิธีชง Cold Brew</a>
          </nav>
          <nav className="ftr__col" aria-label="Balena">
            <p className="ftr__h">Balena</p>
            <a href="/">หน้าแรก</a>
            <a href="/about">รู้จักเรา</a>
            <a href="#contact">ติดต่อเรา</a>
          </nav>
        </div>
        <p className="ftr__copy">© {new Date().getFullYear()} Balena Roastery · สงวนลิขสิทธิ์</p>
      </footer>
    </>
  );
}

export function Shell({ page, children, tone = "dark", lang = "th", tools }: {
  page: Page; children: ReactNode; tone?: "dark" | "light"; lang?: Lang; tools?: ReactNode;
}) {
  return (
    <>
      <a className="skip" href="#main">{lang === "en" ? "Skip to content" : "ข้ามไปเนื้อหา"}</a>
      <Header page={page} tone={tone} lang={lang} tools={tools} />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
