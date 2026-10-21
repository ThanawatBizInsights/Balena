// WHERE TO ADD SHOP, CHAT AND PURCHASE LINKS. The one place for every channel URL.
//
// 1. `storeLinks`: your shop or chat page on each channel. Used by the /shop page, the
//    "ติดต่อเรา" section at the bottom of every page, and the buy buttons of every product that
//    has no link of its own.
// 2. `productLinks`: a link to one product's own listing, by product slug (the slugs are in
//    src/data/products.ts). A product link always wins over the store link for that channel.
//
// Paste URLs exactly as the platform gives them (deep links included); they are used as-is.
// Leave a value empty ("") until you have the real URL. Empty or non-https values are ignored:
// that channel's button is simply not shown. Never put a guessed URL here.
// Button and card wording lives in src/i18n/shop.ts (`buy.channels`, `hub`).

export type Channel = "shopee" | "lineShop" | "lineOA" | "facebook" | "lazada" | "grab" | "grabCharoenKrung";

export const storeLinks: Record<Channel, string> = {
  shopee: "https://s.shopee.co.th/9066BIm3oO",
  lineShop: "https://shop.line.me/@808wjfen",
  lineOA: "https://lin.ee/v9eoe5f",
  facebook: "https://www.facebook.com/balenaroastery",
  lazada: "https://www.lazada.co.th/shop/balena-roastery/",
  // Grab Delivery, Bang Yai branch (opens the Grab app; keep the encoded deep link intact).
  grab: "https://grab.onelink.me/2695613898?pid=inappsharing&c=3-C8KBGY42GPK1NE&is_retargeting=true&af_dp=grab%3A%2F%2Fopen%3FscreenType%3DGRABFOOD%26sourceID%3DA4pcqCZkS4%26merchantIDs%3D3-C8KBGY42GPK1NE&af_force_deeplink=true&af_web_dp=https%3A%2F%2Fwww.grab.com%2Fdownload",
  grabCharoenKrung: "", // opening soon: paste the Grab share link here when the branch is live
};

/**
 * Logo for each /shop row, from public/images/channels/ (owner-supplied, used unaltered).
 * null = no logo supplied yet: the row shows a plain icon instead.
 */
export const CHANNEL_LOGOS: Record<Channel | "website", { src: string; width: number; height: number } | null> = {
  shopee: { src: "/images/channels/shopee.svg", width: 264, height: 375 },
  lineShop: { src: "/images/channels/line-myshop.png", width: 144, height: 144 }, // LINE MyShop app icon (shop.line.me stores)
  lineOA: { src: "/images/channels/line.svg", width: 320, height: 320 },
  lazada: { src: "/images/channels/lazada.png", width: 192, height: 192 },
  grab: { src: "/images/channels/grab.png", width: 192, height: 192 },
  grabCharoenKrung: { src: "/images/channels/grab.png", width: 192, height: 192 },
  facebook: { src: "/images/channels/facebook.png", width: 192, height: 192 },
  website: { src: "/images/balena-whale-sticker.webp", width: 1254, height: 1254 },
};

/** Channels that sell the products in the catalogue (Grab is a branch menu, so it isn't one). */
/**
 * Channels announced on /shop before they have a link: shown as a plain "coming soon" row
 * (not clickable). Remove the entry once its URL is set above.
 */
export const COMING_SOON: Channel[] = ["grabCharoenKrung"];

export const PRODUCT_CHANNELS: Channel[] = ["shopee", "lazada", "lineShop", "lineOA", "facebook"];

/**
 * Rows on /shop, grouped under headings, in order. "website" is this site's home page.
 * A channel with no link is left out, unless it is listed in COMING_SOON.
 */
export const SHOP_HUB: { group: "online" | "delivery"; items: (Channel | "website")[] }[] = [
  { group: "online", items: ["shopee", "lineShop", "lazada", "lineOA", "facebook", "website"] },
  { group: "delivery", items: ["grab", "grabCharoenKrung"] },
];

export const productLinks: Partial<Record<string, Partial<Record<Channel, string>>>> = {
  // "brazil-santos": {
  //   shopee: "https://shopee.co.th/…",
  //   lazada: "https://www.lazada.co.th/products/…",
  // },
};
