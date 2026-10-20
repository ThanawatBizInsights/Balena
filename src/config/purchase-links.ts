// WHERE TO ADD PURCHASE LINKS.
//
// 1. `storeLinks`: your shop or chat page on each channel. Used for every product that has no
//    link of its own, and for the "ติดต่อเรา" section at the bottom of every page.
// 2. `productLinks`: a link to one product's own listing, by product slug (the slugs are in
//    src/data/products.ts). A product link always wins over the store link for that channel.
//
// Leave a value empty ("") until you have the real URL. Empty or non-https values are ignored:
// that channel's button is simply not shown. If a product has no usable link at all, the
// page says "ช่องทางสั่งซื้อจะอัปเดตเร็ว ๆ นี้". Never put a guessed URL here.

export type Channel = "shopee" | "facebook" | "lineOA" | "lazada";

export const storeLinks: Record<Channel, string> = {
  shopee: "", // e.g. your Shopee shop page
  facebook: "", // e.g. your Facebook page or Messenger link (m.me/…)
  lineOA: "", // e.g. https://line.me/R/ti/p/@yourid
  lazada: "", // e.g. your Lazada shop page
};

export const productLinks: Partial<Record<string, Partial<Record<Channel, string>>>> = {
  // "brazil-santos": {
  //   shopee: "https://shopee.co.th/…",
  //   lazada: "https://www.lazada.co.th/products/…",
  // },
};
