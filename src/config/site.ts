// Links and the product photo for the recipe page. Purchase links for the shop pages live in
// src/config/purchase-links.ts. Leave a value empty until the real one is confirmed:
// empty links render as disabled buttons, and an empty photo shows a plain frame.
// Never put a guessed URL here.

export const site = {
  brand: "Balena Roastery",

  /** Public address used for canonical links and the sitemap (no trailing slash). */
  url: "https://www.balenaroastery.com",

  links: {
    /** Where "สั่งซื้อ Balena Cold Brew" goes, e.g. the shop page or LINE shop. */
    order: "",
    /** Where "สอบถามวิธีชง" goes, e.g. the LINE OA chat link (https://line.me/R/ti/p/@…). */
    ask: "",
  },

  productImage: {
    /** Put the supplied photo in public/images/ and set e.g. "images/balena-cold-brew-original-500ml.jpg". */
    src: "",
    /** The photo's real pixel size, so the browser reserves the right space. */
    width: 1000,
    height: 1250,
  },
};

/** Resolves a path in public/ (e.g. "images/x.jpg") to its URL on the site. */
export function assetUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

/**
 * Sign-in page of the partners' operations app, linked discreetly from the footer. The app itself
 * requires a team login; this is only the entry point. Used exactly as given by the owner.
 */
export const STAFF_OPS_URL = "https://balena-bds1oy38b-kraithanawat-2502.vercel.app/ops#/";
