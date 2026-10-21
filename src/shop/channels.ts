// Resolves purchase links from src/config/purchase-links.ts. Pages never read that file
// directly, so the "missing link = no button" rule lives in one place. Button wording is in
// src/i18n/shop.ts (buy.channels, hub), in Thai and English.
import { PRODUCT_CHANNELS, productLinks, storeLinks, type Channel } from "../config/purchase-links";

/** The URL exactly as configured (never re-encoded), or null if it isn't a usable https link. */
export function usable(url: string | undefined): string | null {
  const value = url?.trim();
  if (!value) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

export type ResolvedLink = { id: Channel; href: string };

/** Buy links for one product (product link first, then the store link), or the store links. */
export function linksFor(slug?: string): ResolvedLink[] {
  const own = slug ? productLinks[slug] ?? {} : {};
  return PRODUCT_CHANNELS.flatMap((id) => {
    const href = usable(own[id]) ?? usable(storeLinks[id]);
    return href ? [{ id, href }] : [];
  });
}

/** A store-level link (e.g. for the /shop cards), or null when not configured. */
export const storeLink = (id: Channel) => usable(storeLinks[id]);
