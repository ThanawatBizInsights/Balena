// Resolves purchase links from src/config/purchase-links.ts. Pages never read that file
// directly, so the "missing link = no button" rule lives in one place. Button wording is in
// src/i18n/shop.ts (buy.channels), in Thai and English.
import { productLinks, storeLinks, type Channel } from "../config/purchase-links";

/** Display order. */
export const CHANNEL_ORDER: Channel[] = ["shopee", "lazada", "lineOA", "facebook"];

const usable = (url: string | undefined) => {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
};

export type ResolvedLink = { id: Channel; href: string };

/** Links for one product (product link first, then the store link), or the store links. */
export function linksFor(slug?: string): ResolvedLink[] {
  const own = slug ? productLinks[slug] ?? {} : {};
  return CHANNEL_ORDER.flatMap((id) => {
    const href = usable(own[id]) ?? usable(storeLinks[id]);
    return href ? [{ id, href }] : [];
  });
}
