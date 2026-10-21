import { useEffect, useRef, useState } from "react";
import { SHOP_HUB } from "../config/purchase-links";
import { site } from "../config/site";
import { storeLink } from "./channels";
import { Arrow, Shell, Wordmark, useText } from "./ui";

/** The address the copy button shares: always production, never a preview URL. */
export const SHOP_URL = `${site.url}/shop`;

type Card = (typeof SHOP_HUB)[number];
const TAG: Record<Card, "shop" | "chat" | "site" | "delivery"> = {
  shopee: "shop", lineShop: "shop", lineOA: "chat", website: "site", grab: "delivery",
  facebook: "chat", lazada: "shop",
};

/** /shop: every shopping and contact channel on one page, for social posts and QR codes. */
export function ShopPage() {
  return (
    <Shell page="shop">
      <ShopBody />
    </Shell>
  );
}

function ShopBody() {
  const t = useText();
  const h = t.hub;
  // Only channels with a real link get a card; the website card is this site's home page.
  const cards = SHOP_HUB.flatMap((id): { id: Card; href: string; external: boolean }[] => {
    if (id === "website") return [{ id, href: "/", external: false }];
    const href = storeLink(id);
    return href ? [{ id, href, external: true }] : [];
  });

  return (
    <div className="hub">
      <section className="hub__intro" aria-labelledby="hub-title">
        <div className="hub__brand">
          <img className="hub__mascot" src="/images/balena-whale-sticker.webp" width={1254} height={1254}
            alt={h.mascotAlt} decoding="async" fetchPriority="high" />
          <Wordmark light />
        </div>
        <h1 id="hub-title" className="hub__title">{h.title}</h1>
        <p className="hub__lead">{h.lead}</p>
        <p className="hub__text">{h.text}</p>
      </section>

      <ul className="hub__cards" aria-label={h.listLabel}>
        {cards.map((c) => {
          const card = h.cards[c.id as keyof typeof h.cards];
          const opens = c.id === "lineOA" || c.id === "lineShop" ? h.opensIn.line : c.id === "grab" ? h.opensIn.grab : null;
          return (
            <li key={c.id} className={`hub-card is-${c.id}`}>
              <a className="hub-card__link" href={c.href}
                {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                aria-label={`${card.button}: ${card.title}${c.external ? ` (${t.common.newTab})` : ""}`}>
                <span className="hub-card__icon" aria-hidden="true"><HubIcon kind={TAG[c.id]} /></span>
                <span className="hub-card__body">
                  <span className="hub-card__tag">{h.tags[TAG[c.id]]}</span>
                  <span className="hub-card__title" lang={/[\u0E00-\u0E7F]/.test(card.title) ? "th" : "en"}>{card.title}</span>
                  <span className="hub-card__desc">{card.description}</span>
                  {opens && <span className="hub-card__note">{opens}</span>}
                </span>
                <span className="hub-card__btn">{card.button} <Arrow /></span>
              </a>
            </li>
          );
        })}
      </ul>

      <CopyLink />
    </div>
  );
}

/** Copies the production address. Falls back to a selectable link when the clipboard is blocked. */
function CopyLink() {
  const { hub } = useText();
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<number>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(SHOP_URL);
      ok = true;
    } catch {
      // Older in-app browsers (e.g. some LINE versions) block the clipboard API.
      const area = document.createElement("textarea");
      area.value = SHOP_URL;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.append(area);
      area.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      area.remove();
    }
    setState(ok ? "done" : "failed");
    clearTimeout(timer.current);
    if (ok) timer.current = window.setTimeout(() => setState("idle"), 3000);
  };

  return (
    <section className="hub__share" aria-label={hub.copy.button}>
      <p className="hub__share-hint">{hub.copy.hint}</p>
      <button type="button" className="btn btn--navy" onClick={copy}>
        <CopyIcon /> {hub.copy.button}
      </button>
      <p className={`hub__status is-${state}`} role="status" aria-live="polite">
        {state === "done" ? hub.copy.done : state === "failed" ? hub.copy.failed : ""}
      </p>
      {state === "failed" && <a className="hub__url" href={SHOP_URL} lang="en">{SHOP_URL}</a>}
    </section>
  );
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Plain shapes, not the platforms' logos. */
function HubIcon({ kind }: { kind: "shop" | "chat" | "site" | "delivery" }) {
  const common = { width: 28, height: 28, viewBox: "0 0 26 26" };
  if (kind === "chat") {
    return <svg {...common}><path d="M13 4 C 7 4, 3 8, 3 12.5 C 3 17, 7 20.5, 12 21 L 11 24 L 16 20.5 C 20 19.5, 23 16.5, 23 12.5 C 23 8, 19 4, 13 4 Z" fill="currentColor" /></svg>;
  }
  if (kind === "site") {
    return (
      <svg {...common}>
        <circle cx="13" cy="13" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M3.5 13h19M13 3.5c3 3 3 16 0 19M13 3.5c-3 3-3 16 0 19" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === "delivery") {
    return (
      <svg {...common}>
        <circle cx="7" cy="19" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="20" cy="19" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M7 19h6l3-7h4M16 12l4 7M11 9h6v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 9 H21 L20 23 H6 Z" fill="currentColor" />
      <path d="M9 9 V7 A4 4 0 0 1 17 7 V9" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
