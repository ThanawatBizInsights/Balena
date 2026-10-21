import { useEffect, useRef, useState } from "react";
import { CHANNEL_LOGOS, SHOP_HUB } from "../config/purchase-links";
import { site } from "../config/site";
import { storeLink } from "./channels";
import { Arrow, Shell, useText } from "./ui";

/** The address the copy button shares: always production, never a preview URL. */
export const SHOP_URL = `${site.url}/shop`;

type Item = (typeof SHOP_HUB)[number]["items"][number];
type Kind = "shop" | "chat" | "site" | "delivery";
const KIND: Record<Item, Kind> = {
  shopee: "shop", lineShop: "shop", lazada: "shop", lineOA: "chat", facebook: "chat", website: "site",
  grab: "delivery", grabCharoenKrung: "delivery",
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
  // Only channels with a real link get a row; the website row is this site's home page.
  const groups = SHOP_HUB.map(({ group, items }) => ({
    group,
    rows: items.flatMap((id): { id: Item; href: string; external: boolean }[] => {
      if (id === "website") return [{ id, href: "/", external: false }];
      const href = storeLink(id);
      return href ? [{ id, href, external: true }] : [];
    }),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="hub">
      <div className="hub__in">
        <section className="hub__profile" aria-labelledby="hub-title">
          <CopyLink />
          <img className="hub__avatar" src="/images/balena-whale-sticker.webp" width={1254} height={1254}
            alt={h.mascotAlt} decoding="async" fetchPriority="high" />
          <h1 id="hub-title" className="hub__title">{h.title}</h1>
          <p className="hub__lead">{h.lead}</p>
        </section>

        <div id="contact" className="hub__groups">
          {groups.map((g) => (
            <section key={g.group} className="hub__group" aria-labelledby={`hub-${g.group}`}>
              <h2 id={`hub-${g.group}`} className="hub__group-h">{h.groups[g.group]}</h2>
              <ul className="hub__rows">
                {g.rows.map((r) => {
                  const row = h.cards[r.id];
                  const logo = CHANNEL_LOGOS[r.id];
                  // Two visible lines only: the platform name and one short line (a shorter
                  // wording replaces it on very narrow screens). The full action is the label.
                  return (
                    <li key={r.id} className={`hub-row is-${r.id}`}>
                      <a className="hub-row__link" href={r.href}
                        {...(r.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        aria-label={`${row.action}${r.external ? ` (${t.common.newTab})` : ""}`}>
                        <span className={`hub-row__logo ${logo ? "" : "is-icon"}`} aria-hidden="true">
                          {logo ? <img src={logo.src} width={logo.width} height={logo.height} alt="" loading="lazy" decoding="async" />
                            : <HubIcon kind={KIND[r.id]} />}
                        </span>
                        <span className="hub-row__text">
                          <span className="hub-row__title" lang={/[\u0E00-\u0E7F]/.test(row.title) ? "th" : "en"}>{row.title}</span>
                          <span className="hub-row__line">
                            <span className="hub-row__long">{row.line}</span>
                            <span className="hub-row__short">{row.short}</span>
                          </span>
                        </span>
                        <span className="hub-row__go" aria-hidden="true"><Arrow /></span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
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
    <div className="hub__share">
      <button type="button" className="hub__share-btn" onClick={copy} aria-label={hub.copy.button} title={hub.copy.button}>
        <CopyIcon />
        <span className="hub__share-label">{hub.copy.button}</span>
      </button>
      <p className={`hub__status is-${state}`} role="status" aria-live="polite">
        {state === "done" ? hub.copy.done : state === "failed" ? hub.copy.failed : ""}
      </p>
      {state === "failed" && <a className="hub__url" href={SHOP_URL} lang="en">{SHOP_URL}</a>}
    </div>
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
