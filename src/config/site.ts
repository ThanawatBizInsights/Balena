// Links and the product photo. Leave a value empty until the real one is confirmed:
// empty links render as disabled buttons, and an empty photo shows a plain frame.
// Never put a guessed URL here.

export const site = {
  brand: "Balena Roastery",

  links: {
    /** Where "สั่งซื้อ Balena Cold Brew" goes, e.g. the shop page or LINE shop. */
    order: "",
    /** Where "สอบถามวิธีชง" goes, e.g. the LINE OA chat link (https://line.me/R/ti/p/@…). */
    ask: "",
  },

  productImage: {
    /** Put the supplied photo in public/images/ and set e.g. "images/balena-cold-brew-original-500ml.jpg". */
    src: "",
    alt: "Balena Cold Brew Concentrate สูตร Original ขนาด 500 มล.",
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
