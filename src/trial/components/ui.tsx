import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { Product, ProductImage } from "../data/products";
import { site } from "../../config/site";
import { Link, navigate, usePath } from "../router";
import { useCart, MAX_QTY } from "../state/cart";
import { baht, setTestPrices, useTestPrices, type PriceInfo } from "../state/pricing";

/* ---------- product image: responsive webp, keeps proportions, survives a missing file ---------- */

export function ProductImg({ img, sizes = "(min-width: 900px) 40vw, 80vw", eager = false, className }: {
  img: ProductImage; sizes?: string; eager?: boolean; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className={`img-missing ${className ?? ""}`} role="img" aria-label={img.alt}><span>ไม่พบรูป</span></div>;
  }
  const base = `/trial/products/${img.file}`;
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

/* ---------- price ---------- */

export function PriceTag({ info, big = false }: { info: PriceInfo; big?: boolean }) {
  if (info.amount == null) return <span className={`price is-ask ${big ? "is-big" : ""}`}>สอบถามราคา</span>;
  return (
    <span className={`price ${big ? "is-big" : ""}`}>
      {baht(info.amount)}
      {info.isTest && <span className="test-badge">ราคาทดสอบ</span>}
    </span>
  );
}

export function Qty({ value, onChange, label, min = 1 }: { value: number; onChange: (n: number) => void; label: string; min?: number }) {
  return (
    <div className="qty" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="ลดจำนวน">−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(MAX_QTY, value + 1))} disabled={value >= MAX_QTY} aria-label="เพิ่มจำนวน">+</button>
    </div>
  );
}

/* ---------- add-to-cart feedback ---------- */

type Toast = { id: number; text: string };
let toast: Toast | null = null;
const toastListeners = new Set<() => void>();
export function showToast(text: string) {
  toast = { id: Date.now(), text };
  toastListeners.forEach((l) => l());
}
function useToast() {
  return useSyncExternalStore((l) => { toastListeners.add(l); return () => toastListeners.delete(l); }, () => toast, () => null);
}

function ToastHost() {
  const t = useToast();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!t) return;
    setVisible(true);
    const h = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(h);
  }, [t]);
  return (
    <div className={`toast ${visible ? "is-on" : ""}`} role="status" aria-live="polite">
      {t && visible ? <><span className="toast__tick" aria-hidden="true">✓</span>{t.text} <Link to="/trial/cart">ดูตะกร้า</Link></> : null}
    </div>
  );
}

/* ---------- header, footer, trial banner ---------- */

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={`wordmark ${light ? "is-light" : ""}`}>
      Balena<small>Roastery</small>
    </span>
  );
}

function CartButton() {
  const cart = useCart();
  const count = cart.reduce((n, l) => n + l.qty, 0);
  const [bump, setBump] = useState(false);
  const prev = useRef(count);
  useEffect(() => {
    if (count > prev.current) { setBump(true); const h = setTimeout(() => setBump(false), 500); prev.current = count; return () => clearTimeout(h); }
    prev.current = count;
  }, [count]);
  return (
    <Link to="/trial/cart" className={`cart-btn ${bump ? "is-bump" : ""}`} aria-label={`ตะกร้า ${count} ชิ้น`}>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
      <span>ตะกร้า</span>
      <b className="cart-btn__count">{count}</b>
    </Link>
  );
}

export function Header({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [open, setOpen] = useState(false);
  const path = usePath();
  useEffect(() => setOpen(false), [path]);
  const links = [
    { to: "/trial#cold-brew", label: "โคลด์บรูว์" },
    { to: "/trial#beans", label: "เมล็ดกาแฟ" },
    { to: "/trial/order", label: "สั่งซื้อ" },
  ];
  return (
    <header className={`hdr is-${tone}`}>
      <div className="hdr__in">
        <Link to="/trial" className="hdr__brand" aria-label="Balena Roastery หน้าแรก (ทดลอง)"><Wordmark light={tone === "dark"} /></Link>
        <nav aria-label="เมนูหลัก" className={`hdr__nav ${open ? "is-open" : ""}`} id="trial-nav">
          {links.map((l) => (
            <a key={l.to} href={l.to} onClick={(e) => {
              setOpen(false);
              const [p, hash] = l.to.split("#");
              if (hash && path === p) return; // same page: the anchor scrolls by itself
              e.preventDefault();
              navigate(p);
              if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
            }}>{l.label}</a>
          ))}
        </nav>
        <div className="hdr__tools">
          <CartButton />
          <button type="button" className="hdr__menu" aria-expanded={open} aria-controls="trial-nav" onClick={() => setOpen((o) => !o)}>
            {open ? "ปิด" : "เมนู"}
          </button>
        </div>
      </div>
    </header>
  );
}

export function TrialRibbon() {
  return (
    <p className="ribbon">
      หน้าทดลองดีไซน์ใหม่ ยังไม่ใช่หน้าขายจริง <a href="/">กลับเว็บไซต์ปัจจุบัน</a>
    </p>
  );
}

export function Footer() {
  const testPrices = useTestPrices();
  const channels: [string, string][] = [
    ["LINE OA", site.channels.lineOA], ["LINE SHOPPING", site.channels.lineShop],
    ["Shopee", site.channels.shopee], ["Facebook", site.channels.facebook],
  ];
  return (
    <footer className="ftr">
      <div className="ftr__in">
        <div className="ftr__brand">
          <Wordmark light />
          <p className="ftr__tag">Good Coffee. Brighter Days.</p>
          <p className="ftr__small">Big whale. Small batch.</p>
        </div>
        <nav className="ftr__col" aria-label="ร้าน">
          <p className="ftr__h">ร้าน</p>
          <Link to="/trial/order">สั่งซื้อ</Link>
          <a href="/trial#cold-brew">โคลด์บรูว์</a>
          <a href="/trial#beans">เมล็ดกาแฟ</a>
          <a href="/cold-brew-recipes/">วิธีชง Cold Brew</a>
        </nav>
        <div className="ftr__col">
          <p className="ftr__h">ช่องทางติดต่อ</p>
          <ul className="ftr__channels">
            {channels.map(([name, url]) => (
              <li key={name}>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{name}</a> : <span>{name} <em>เร็ว ๆ นี้</em></span>}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="ftr__trial">
        <p>หน้านี้เป็นการทดลองดีไซน์ ไม่มีการรับคำสั่งซื้อหรือชำระเงินจริง</p>
        <label className="switch">
          <input type="checkbox" checked={testPrices} onChange={(e) => setTestPrices(e.target.checked)} />
          <span>สำหรับทีมงาน: ใช้ราคาทดสอบ ฿100 กับสินค้าที่ยังไม่มีราคา เพื่อลองตะกร้าและการสั่งซื้อ</span>
        </label>
      </div>
    </footer>
  );
}

export function Shell({ children, tone = "dark" }: { children: ReactNode; tone?: "dark" | "light" }) {
  return (
    <>
      <a className="skip" href="#main">ข้ามไปเนื้อหา</a>
      <TrialRibbon />
      <Header tone={tone} />
      <main id="main">{children}</main>
      <Footer />
      <ToastHost />
    </>
  );
}
