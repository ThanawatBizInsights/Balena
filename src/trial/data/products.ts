// The one product data source for the trial storefront (/trial/...).
//
// Sources: the owner's bean list (names, sizes), the bag and pouch labels in
// Balena_Products.zip (process, altitude, taste notes, roast level, net weight, label text),
// and the existing site. Nothing here is guessed: anything not confirmed is `null` and listed
// in `gaps`, which docs/TRIAL.md collects for the owner.
//
// PRICES: none are confirmed yet, so every `price` is null. The shop then shows "สอบถามราคา"
// and disables buying. Put the real price (in whole baht) on each variant when confirmed.

export type Category = "cold-brew" | "beans";

export type Variant = {
  id: string;
  /** Shown on the size pill, e.g. "200 g". */
  label: string;
  /** Price in satang (1 baht = 100 satang); null = not confirmed, not purchasable. */
  price: number | null;
  available: boolean;
};

export type ProductImage = {
  /** Base name in public/trial/products/; served as -480.webp and -960.webp. */
  file: string;
  width: number;
  height: number;
  alt: string;
  /** True for transparent cutouts; false for photos with a background. */
  cutout: boolean;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  /** Second line under the name, from the label. */
  subtitle: string;
  category: Category;
  images: ProductImage[];
  /** Short Thai description using only label facts. */
  description: string;
  /** Label facts, in display order. */
  attributes: { label: string; value: string }[];
  variants: Variant[];
  /** Colour taken from the product's own bag or label. */
  accent: string;
  /** What still needs the owner's confirmation. */
  gaps: string[];
};

const bag = (file: string, alt: string): ProductImage => ({ file, width: 1122, height: 1402, alt, cutout: true });
const NO_PRICE = "ราคายังไม่ได้รับการยืนยัน";
const BEAN_GAPS = ["ราคา", "ตัวเลือกการบด (ฉลากระบุ Whole Bean เท่านั้น)", "สต็อก"];

const bean = (p: {
  slug: string; name: string; subtitle?: string; size: 100 | 200; process: string; altitude: string;
  notes: string; roast: string | null; accent: string; extraGaps?: string[]; images?: ProductImage[];
}): Product => ({
  id: p.slug,
  slug: p.slug,
  name: p.name,
  subtitle: p.subtitle ?? "Whole Bean Coffee",
  category: "beans",
  images: p.images ?? [bag(p.slug, `ถุงเมล็ดกาแฟ Balena ${p.name} ${p.size} กรัม`)],
  description: `เมล็ดกาแฟคั่ว ${p.name} โน้ตรสชาติตามฉลาก: ${p.notes}`,
  attributes: [
    { label: "Process", value: p.process },
    { label: "Altitude", value: p.altitude },
    { label: "Taste notes", value: p.notes },
    { label: "ระดับการคั่ว", value: p.roast ?? "ยังไม่ระบุ" },
    { label: "น้ำหนักสุทธิ", value: `${p.size} g` },
    { label: "รูปแบบ", value: "Whole Bean (เมล็ด)" },
  ],
  variants: [{ id: `${p.size}g`, label: `${p.size} g`, price: null, available: true }],
  accent: p.accent,
  gaps: [...BEAN_GAPS, ...(p.extraGaps ?? [])],
});

export const products: Product[] = [
  {
    id: "cold-brew-concentrate-smooth-black",
    slug: "cold-brew-concentrate-smooth-black",
    name: "Cold Brew Concentrate",
    subtitle: "Smooth Black · 500 mL",
    category: "cold-brew",
    images: [{
      file: "cold-brew-concentrate-smooth-black", width: 1024, height: 1536, cutout: true,
      alt: "ถุง Balena Cold Brew Concentrate Smooth Black 500 มล. มีจุกเกลียว",
    }],
    description: "กาแฟสกัดเย็นแบบเข้มข้นในถุงมีจุก ชงง่ายที่บ้าน เข้มอร่อยได้ทุกเมนู",
    attributes: [
      { label: "ประเภท", value: "Cold Brew Concentrate" },
      { label: "รส", value: "Smooth Black" },
      { label: "ขนาด", value: "500 mL" },
      { label: "บนฉลาก", value: "Bold flavour, smoother days." },
    ],
    variants: [{ id: "500ml", label: "500 mL", price: null, available: true }],
    accent: "#1b3c94",
    gaps: ["ราคา", "สต็อก", "เป็นสินค้าเดียวกับ \"Cold Brew Concentrate Original\" บนเว็บปัจจุบันหรือไม่"],
  },
  {
    id: "cold-brew-coffee-original",
    slug: "cold-brew-coffee-original",
    name: "Cold Brew Coffee",
    subtitle: "Original · 500 mL",
    category: "cold-brew",
    images: [{
      file: "cold-brew-coffee-original", width: 1122, height: 1402, cutout: false,
      alt: "ถุง Balena Cold Brew Coffee Original 500 มล. วางบนเคาน์เตอร์ ข้างแก้วกาแฟเย็น",
    }],
    description: "Balena Cold Brew Coffee สูตร Original ขนาด 500 มล.",
    attributes: [
      { label: "ประเภท", value: "Cold Brew Coffee" },
      { label: "รส", value: "Original" },
      { label: "ขนาด", value: "500 mL" },
      { label: "บนฉลาก", value: "Bold flavour, smoother days." },
    ],
    variants: [{ id: "500ml", label: "500 mL", price: null, available: true }],
    accent: "#2563c9",
    gaps: [
      "ราคา", "สต็อก",
      "ฉลากเขียน \"Cold Brew Coffee\" ไม่ใช่ \"Concentrate\": เป็นแบบพร้อมดื่มหรือแบบเข้มข้น",
      "มีแต่ภาพถ่ายพร้อมฉากหลัง ยังไม่มีภาพตัดพื้น",
    ],
  },
  bean({ slug: "brazil-santos", name: "Brazil Santos", size: 200, process: "Natural Process", altitude: "800 - 1,300 masl.",
    notes: "Brown sugar, Chocolate, Hazelnut", roast: null, accent: "#6b3e26",
    extraGaps: ["ระดับการคั่ว (ฉลากมีแต่แถบสี)", "รายละเอียดเหมือน Vino Rosso ทุกช่อง", "ชื่อไฟล์สะกด Brasil"] }),
  bean({ slug: "brazil-cerrado", name: "Brazil Cerrado", size: 200, process: "Semi-Washed Process", altitude: "1,000 - 1,300 masl.",
    notes: "Chocolate, Hazelnut, Sweet & Smooth", roast: "Medium Dark", accent: "#b8873c", extraGaps: ["ชื่อไฟล์สะกด Brasil"] }),
  bean({ slug: "laos-bolaven", name: "Laos Bolaven", size: 200, process: "Wash Process", altitude: "1,100 - 1,300 masl.",
    notes: "Dark Chocolate, Nutty, Full body", roast: "Medium Dark", accent: "#d98a5f" }),
  bean({ slug: "house-blends", name: "House Blends", size: 200, process: "Dry & Wash", altitude: "1,100 - 1,300 masl.",
    notes: "Hazelnut, Dark Chocolate & Smooth", roast: "Medium Dark", accent: "#2f5d7c",
    extraGaps: ["แหล่งที่มาของเบลนด์"],
    images: [
      bag("house-blends", "ถุงเมล็ดกาแฟ Balena House Blends 200 กรัม"),
      { file: "house-blends-alt", width: 1254, height: 1254, cutout: false, alt: "ถุง Balena House Blends 200 กรัม บนพื้นขาว" },
    ] }),
  bean({ slug: "kenya-muranga", name: "Kenya Muranga", size: 200, process: "Washed Process", altitude: "1,700 - 2,200 masl.",
    notes: "Mix Berry, Citrusy, Dark Chocolate", roast: "Light", accent: "#c8323a", extraGaps: ["สะกด Muranga หรือ Murang'a"] }),
  bean({ slug: "milk-choc", name: "Milk Choc", size: 200, process: "Wash Process", altitude: "1,100 - 1,300 masl.",
    notes: "Hazelnut, Dark Chocolate, Caramel", roast: "Medium Dark", accent: "#8a5a3c", extraGaps: ["แหล่งที่มา"] }),
  bean({ slug: "vino-rosso", name: "Vino Rosso", size: 200, process: "Natural Process", altitude: "800 - 1,300 masl.",
    notes: "Brown sugar, Chocolate, Hazelnut", roast: "Medium Light", accent: "#a8253a",
    extraGaps: ["แหล่งที่มา", "รายละเอียดเหมือน Brazil Santos ทุกช่อง"] }),
  bean({ slug: "52hz-signature-blend", name: "52 Hz.", subtitle: "Signature Blend · Whole Bean", size: 200, process: "Red Honey",
    altitude: "1,300 - 1,500 masl.", notes: "Red grape, Floral, Wine", roast: "Medium Light", accent: "#1f9fb8",
    extraGaps: ["แหล่งที่มาของเบลนด์"] }),
  bean({ slug: "blue-magic", name: "Blue Magic", size: 100, process: "Anaerobic", altitude: "1,100 - 1,300 masl.",
    notes: "Blueberry, Vanilla cheesecake, Jam", roast: "Light", accent: "#4c5fb0", extraGaps: ["แหล่งที่มา"] }),
  bean({ slug: "whiskey", name: "Whiskey", size: 100, process: "Anaerobic Process", altitude: "1,200 - 1,400 masl.",
    notes: "Whiskey, Vanilla, Honey", roast: "Light", accent: "#b9772a",
    extraGaps: ["แหล่งที่มา", "กฎแพลตฟอร์มเรื่องคำเกี่ยวกับแอลกอฮอล์"] }),
];

export const CATEGORIES: { id: Category; th: string; en: string }[] = [
  { id: "cold-brew", th: "โคลด์บรูว์", en: "Cold Brew" },
  { id: "beans", th: "เมล็ดกาแฟ", en: "Coffee Beans" },
];

export const bySlug = (slug: string) => products.find((p) => p.slug === slug) ?? null;
export const variantOf = (p: Product, id: string) => p.variants.find((v) => v.id === id) ?? null;
export const NO_PRICE_LABEL = NO_PRICE;
