// The one product data source for the home page (/), the catalogue (/products) and the Meta
// catalog CSV (tools/catalog/build-meta.mjs).
//
// Sources: the owner's bean list (names, sizes), the bag and pouch labels in
// Balena_Products.zip (process, altitude, taste notes, roast level, net weight, label text),
// and the existing site. Nothing here is guessed: a field we can't confirm is left out (the
// page then shows no row for it) and listed in `gaps`, which docs/STOREFRONT.md collects.
//
// Purchase links are not here: see src/config/purchase-links.ts.

export type Category = "cold-brew" | "beans";

export type ProductImage = {
  /** Base name in public/images/products/; served as -480.webp and -960.webp. */
  file: string;
  width: number;
  height: number;
  alt: string;
  /** True for transparent cutouts; false for photos with a background. */
  cutout: boolean;
};

export type Product = {
  slug: string;
  name: string;
  /** Second line under the name, from the label. */
  subtitle: string;
  category: Category;
  images: ProductImage[];
  /** Short Thai introduction using only label facts. */
  intro: string;
  /** Net size from the label, e.g. "200 g". */
  size: string;
  /** Short stable id for the size, used in Meta catalog ids (e.g. "200g"). */
  sizeId: string;
  /** Label facts. Leave a field out when the label doesn't give it. */
  type?: string;
  flavour?: string;
  notes?: string;
  roast?: string;
  process?: string;
  altitude?: string;
  form?: string;
  /** Suggested use, only where the site already has approved wording. */
  use?: { text: string; link?: { href: string; label: string } };
  /** Colour taken from the product's own bag or label. */
  accent: string;
  /** What still needs the owner's confirmation (developer handoff only, never shown). */
  gaps: string[];
};

const bag = (file: string, alt: string): ProductImage => ({ file, width: 1122, height: 1402, alt, cutout: true });
const BEAN_GAPS = ["ราคา", "ตัวเลือกการบด (ฉลากระบุ Whole Bean เท่านั้น)", "สต็อก"];

const bean = (p: {
  slug: string; name: string; subtitle?: string; size: 100 | 200; process: string; altitude: string;
  notes: string; roast?: string; accent: string; extraGaps?: string[]; images?: ProductImage[];
}): Product => ({
  slug: p.slug,
  name: p.name,
  subtitle: p.subtitle ?? "Whole Bean Coffee",
  category: "beans",
  images: p.images ?? [bag(p.slug, `ถุงเมล็ดกาแฟ Balena ${p.name} ${p.size} กรัม`)],
  intro: `เมล็ดกาแฟคั่ว ${p.name} แบบทั้งเมล็ด ขนาด ${p.size} กรัม จาก Balena Roastery`,
  size: `${p.size} g`,
  sizeId: `${p.size}g`,
  notes: p.notes,
  roast: p.roast,
  process: p.process,
  altitude: p.altitude,
  form: "Whole Bean (เมล็ด)",
  accent: p.accent,
  gaps: [...BEAN_GAPS, ...(p.extraGaps ?? [])],
});

const RECIPES = { href: "/cold-brew-recipes/", label: "ดูวิธีชง Cold Brew" };

export const products: Product[] = [
  {
    slug: "cold-brew-concentrate-smooth-black",
    name: "Cold Brew Concentrate",
    subtitle: "Smooth Black · 500 mL",
    category: "cold-brew",
    images: [{
      file: "cold-brew-concentrate-smooth-black", width: 1024, height: 1536, cutout: true,
      alt: "ถุง Balena Cold Brew Concentrate Smooth Black 500 มล. มีจุกเกลียว",
    }],
    intro: "กาแฟสกัดเย็นแบบเข้มข้นในถุงมีจุก ชงง่ายที่บ้าน เข้มอร่อยได้ทุกเมนู",
    size: "500 mL",
    sizeId: "500ml",
    type: "Cold Brew Concentrate",
    flavour: "Smooth Black",
    use: { text: "ผสมน้ำ นม โซดา หรือน้ำส้ม แล้วปรับความเข้มได้ตามชอบ", link: RECIPES },
    accent: "#1b3c94",
    gaps: ["ราคา", "สต็อก", "เป็นสินค้าเดียวกับ \"Cold Brew Concentrate Original\" บนเว็บเดิมหรือไม่"],
  },
  {
    slug: "cold-brew-coffee-original",
    name: "Cold Brew Coffee",
    subtitle: "Original · 500 mL",
    category: "cold-brew",
    images: [{
      file: "cold-brew-coffee-original", width: 1122, height: 1402, cutout: false,
      alt: "ถุง Balena Cold Brew Coffee Original 500 มล. วางบนเคาน์เตอร์ ข้างแก้วกาแฟเย็น",
    }],
    intro: "Balena Cold Brew Coffee สูตร Original ขนาด 500 มล.",
    size: "500 mL",
    sizeId: "500ml",
    type: "Cold Brew Coffee",
    flavour: "Original",
    accent: "#2563c9",
    gaps: [
      "ราคา", "สต็อก",
      "ฉลากเขียน \"Cold Brew Coffee\" ไม่ใช่ \"Concentrate\": เป็นแบบพร้อมดื่มหรือแบบเข้มข้น (จึงยังไม่แสดงวิธีใช้)",
      "มีแต่ภาพถ่ายพร้อมฉากหลัง ยังไม่มีภาพตัดพื้น",
    ],
  },
  bean({ slug: "brazil-santos", name: "Brazil Santos", size: 200, process: "Natural Process", altitude: "800 - 1,300 masl.",
    notes: "Brown sugar, Chocolate, Hazelnut", accent: "#6b3e26",
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

export const CATEGORIES: { id: Category; anchor: string; th: string; en: string }[] = [
  { id: "cold-brew", anchor: "cold-brew", th: "โคลด์บรูว์", en: "Cold Brew" },
  { id: "beans", anchor: "coffee-beans", th: "เมล็ดกาแฟคั่ว", en: "Coffee Beans" },
];

export const bySlug = (slug: string | null | undefined) => products.find((p) => p.slug === slug) ?? null;
export const inCategory = (c: Category) => products.filter((p) => p.category === c);
export const anchorOf = (c: Category) => CATEGORIES.find((x) => x.id === c)!.anchor;

/** Catalogue address for one product: selects it and scrolls to its section. */
export const productHref = (p: Product) => `/products?p=${p.slug}#${anchorOf(p.category)}`;

/** The product's information rows, in display order. Only fields the label confirms. */
export function factsOf(p: Product): { label: string; value: string; en?: boolean }[] {
  const rows: [string, string | undefined, boolean?][] = [
    ["ประเภท", p.type, true],
    ["รส", p.flavour, true],
    ["รสชาติตามฉลาก", p.notes, true],
    ["ขนาด", p.size, true],
    ["ระดับการคั่ว", p.roast, true],
    ["กระบวนการ", p.process, true],
    ["ความสูงที่ปลูก", p.altitude, true],
    ["รูปแบบ", p.form],
  ];
  return rows.filter((r): r is [string, string, boolean?] => Boolean(r[1])).map(([label, value, en]) => ({ label, value, en }));
}
