// Resolves purchase links from src/config/purchase-links.ts. Pages never read that file
// directly, so the "missing link = no button" rule lives in one place.
import { productLinks, storeLinks, type Channel } from "../config/purchase-links";

export type ChannelInfo = {
  id: Channel;
  name: string;
  /** Button text. Facebook and LINE are chats: the wording says you order there, not pay. */
  action: string;
  /** Short line under the button text. */
  hint: string;
};

/** Display order. */
export const CHANNELS: ChannelInfo[] = [
  { id: "shopee", name: "Shopee", action: "ซื้อผ่าน Shopee", hint: "ร้านค้าบน Shopee" },
  { id: "lazada", name: "Lazada", action: "ซื้อผ่าน Lazada", hint: "ร้านค้าบน Lazada" },
  { id: "lineOA", name: "LINE OA", action: "สั่งซื้อผ่าน LINE OA", hint: "ทักแชทเพื่อสั่งซื้อหรือสอบถาม" },
  { id: "facebook", name: "Facebook", action: "สั่งซื้อผ่าน Facebook", hint: "ทักแชทเพื่อสั่งซื้อหรือสอบถาม" },
];

export const NO_CHANNELS = "ช่องทางสั่งซื้อจะอัปเดตเร็ว\u00A0ๆ นี้";

const usable = (url: string | undefined) => {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
};

export type ResolvedLink = ChannelInfo & { href: string };

/** Links for one product (product link first, then the store link), or the store links. */
export function linksFor(slug?: string): ResolvedLink[] {
  const own = slug ? productLinks[slug] ?? {} : {};
  return CHANNELS.flatMap((c) => {
    const href = usable(own[c.id]) ?? usable(storeLinks[c.id]);
    return href ? [{ ...c, href }] : [];
  });
}
