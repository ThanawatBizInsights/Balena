// The one product data source for the home page (/), the catalogue (/products) and the Meta
// catalog CSV (tools/catalog/build-meta.mjs). EDIT PRODUCT COPY HERE.
//
// Sources:
// - docs/content/coffee-positioning.csv (the owner's positioning sheet): status, size, process
//   and roast, tasting notes, story, difference, positioning, recommended drinks.
// - The bag and pouch photos in public/images/products/ (unchanged).
// Nothing is guessed: a field we can't confirm is left out (the page then shows no row for it)
// and listed in `gaps`, which docs/STOREFRONT.md collects.
//
// What is NOT here: prices, stock, costs and sales. Those live only in the operations system
// (Supabase, /ops/). `opsCodes` only names the matching operations item so the two can be
// compared; nothing on the public site reads or writes operations data.
//
// Purchase links are not here either: see src/config/purchase-links.ts.
//
// Every customer-facing text field is a `T` ({ th, en }); `npm run check:i18n` fails if one
// language is missing, and `npm run check:products` checks this file against the CSV.

export type Category = "cold-brew" | "beans";

/** A string in both languages. */
export type T = { th: string; en: string };
export type Lang = keyof T;

export type ProductImage = {
  /** Base name in public/images/products/; served as -480.webp and -960.webp. */
  file: string;
  width: number;
  height: number;
  alt: T;
  /** True for transparent cutouts; false for photos with a background. */
  cutout: boolean;
};

/**
 * available: on sale (CSV "Current"). planned: not on sale yet (CSV "Planned"); never shows
 * purchase buttons.
 */
export type Status = "available" | "planned";

export type Product = {
  /** Stable id used in addresses (/products?p=<slug>) and Meta catalog ids. Never rename. */
  slug: string;
  /** Full product name as on the label. */
  name: string;
  /** Short name for cards and selection chips (the CSV name). */
  shortName: string;
  /** Second line under the name, from the label. */
  subtitle: string;
  category: Category;
  status: Status;
  /**
   * Shown on the site. Planned products stay unpublished by default; if one is published it is
   * labelled "เร็ว\u00A0ๆ นี้ / Coming soon" and has no purchase buttons.
   */
  published: boolean;
  /** Owner-supplied photos. Empty = no photo yet (the page shows a plain placeholder). */
  images: ProductImage[];
  /** Net size, e.g. "200 g". */
  size: string;
  /** Short stable id for the size, used in Meta catalog ids (e.g. "200g"). */
  sizeId: string;
  /** One short benefit line for product cards. */
  benefit: T;
  /** Short product story (CSV narrative). */
  story: T;
  /** Tasting notes, flavour impressions only (never ingredients). The first three are card tags. */
  notes: T[];
  /** "เหมาะกับใคร / Who it's for", written from the CSV positioning and difference. */
  whoFor: T;
  /** "เมนูแนะนำ / Recommended drinks" (CSV best drinks). */
  drinks: T[];
  /** Confirmed process details. Leave a field out when it isn't confirmed. */
  type?: string;
  flavour?: string;
  process?: string;
  altitude?: string;
  /** Roast: `direction` = the CSV gives a direction ("medium roast direction"), not a confirmed level. */
  roast?: { value: T; direction?: boolean };
  /** Process and roast depend on the roast batch: shows "ข้อมูลขึ้นอยู่กับล็อต / Details vary by batch". */
  batchDependent?: boolean;
  form?: T;
  /** Suggested use, only where the site already has approved wording. */
  use?: { text: T; link?: { href: string; label: T } };
  /** Colour taken from the product's own bag or label (brand ocean when there is no photo yet). */
  accent: string;
  /** Meta catalog id, when it must stay as first published (default `${slug}-${sizeId}`). */
  catalogId?: string;
  /** Editorial fields from the CSV. Internal: used to write the copy above, never shown. */
  internal: {
    /** Product name exactly as in the CSV, and other spellings seen in older records. */
    csvName: string;
    aliases: string[];
    positioning: T;
    difference: T;
    /** Matching item codes in the operations system (same SKU and size). */
    opsCodes: string[];
  };
  /** What still needs the owner's confirmation (developer handoff only, never shown). */
  gaps: string[];
};

const t = (th: string, en: string): T => ({ th, en });
const bag = (file: string, alt: T): ProductImage => ({ file, width: 1122, height: 1402, alt, cutout: true });
const bagAlt = (name: string, size: number) =>
  t(`ถุงเมล็ดกาแฟ Balena ${name} ${size} กรัม`, `Bag of Balena ${name} coffee beans, ${size} g`);
const BEAN_GAPS = ["ราคา", "ตัวเลือกการบด (ฉลากระบุ Whole Bean เท่านั้น)", "สต็อก"];
const NO_PHOTO = "ยังไม่มีรูปสินค้า";
/** Brand ocean, for products that have no bag photo (and so no label colour) yet. */
const OCEAN = "#1d5fd6";

const MEDIUM_DARK = { value: t("กลางค่อนเข้ม", "Medium-dark") };
const LIGHT = { value: t("อ่อน", "Light") };

const bean = (p: Omit<Product, "category" | "subtitle" | "sizeId" | "size" | "shortName" | "status" | "published" | "form" | "images" | "gaps"> & {
  size: 100 | 150 | 200; subtitle?: string; shortName?: string; images?: ProductImage[]; extraGaps?: string[];
}): Product => {
  const { size, extraGaps, ...rest } = p;
  return {
    ...rest,
    shortName: p.shortName ?? p.name,
    subtitle: p.subtitle ?? "Whole Bean Coffee",
    category: "beans",
    status: "available",
    published: true,
    images: p.images ?? [],
    size: `${size} g`,
    sizeId: `${size}g`,
    form: t("Whole Bean (เมล็ด)", "Whole bean"),
    gaps: [...BEAN_GAPS, ...(p.images?.length ? [] : [NO_PHOTO]), ...(extraGaps ?? [])],
  };
};

const RECIPES = { href: "/cold-brew-recipes/", label: t("ดูวิธีชง Cold Brew", "How to brew Cold Brew") };
const COLD_BREW_USE = {
  text: t("ผสมน้ำ นม โซดา หรือน้ำส้ม แล้วปรับความเข้มได้ตามชอบ", "Mix with water, milk, soda or orange juice, then adjust the strength to taste."),
  link: RECIPES,
};

/** Planned cold brew: unpublished, no photo, no ops item, never purchasable. */
const plannedColdBrew = (p: Pick<Product, "slug" | "shortName" | "benefit" | "story" | "notes" | "whoFor" | "drinks" | "internal">): Product => ({
  ...p,
  name: "Cold Brew",
  subtitle: `${p.shortName} · 500 mL`,
  category: "cold-brew",
  status: "planned",
  published: false,
  images: [],
  size: "500 mL",
  sizeId: "500ml",
  type: "Cold Brew",
  flavour: p.shortName,
  accent: OCEAN,
  gaps: ["สินค้าวางแผน: ยังไม่เปิดขาย ไม่แสดงบนเว็บจนกว่าจะเปิด published", NO_PHOTO, "ราคา", "สต็อก"],
});

/** Every product, published or not, in display order (cold brew first, then beans). */
export const allProducts: Product[] = [
  // ---------- Cold brew ----------
  {
    slug: "cold-brew-coffee-original",
    name: "Cold Brew Coffee",
    shortName: "Original",
    subtitle: "Original · 500 mL",
    category: "cold-brew",
    status: "available",
    published: true,
    images: [{
      file: "cold-brew-coffee-original", width: 1122, height: 1402, cutout: false,
      alt: t("ถุง Balena Cold Brew Coffee Original 500 มล. วางบนเคาน์เตอร์ ข้างแก้วกาแฟเย็น", "Balena Cold Brew Coffee Original 500 mL pouch on a counter next to a glass of iced coffee"),
    }],
    size: "500 mL",
    sizeId: "500ml",
    type: "Cold Brew Concentrate",
    flavour: "Original",
    benefit: t("เบสกาแฟอเนกประสงค์ ทำได้ทั้งกาแฟดำและกาแฟนม", "A versatile base for black and milk coffee"),
    story: t(
      "โคลด์บรูว์ตัวหลักของ Balena เป็นกาแฟเข้มข้นที่ต่อยอดได้ง่าย เติมน้ำเป็นกาแฟดำ หรือเติมนมเป็นกาแฟนมได้ภายในไม่กี่วินาที",
      "The core Balena cold brew: a versatile concentrated coffee base that can become black coffee or milk coffee in seconds.",
    ),
    notes: [t("เข้ม", "Bold"), t("สมดุล", "Balanced"), t("ขมนิด\u00A0ๆ", "Slightly bitter")],
    whoFor: t(
      "คนที่อยากมีเบสกาแฟติดตู้เย็นไว้ทำได้ทั้งกาแฟดำและกาแฟนมที่บ้าน เป็นรสมาตรฐานของไลน์โคลด์บรูว์",
      "Anyone who wants one coffee base at home for both black and milk drinks. It's the benchmark flavour of the range.",
    ),
    drinks: [t("กาแฟดำ", "Black"), t("อเมริกาโน", "Americano"), t("กาแฟนม", "Milk coffee"), t("กาแฟโอ๊ตมิลค์", "Oat milk coffee")],
    use: COLD_BREW_USE,
    accent: "#2563c9",
    internal: {
      csvName: "Original", aliases: ["Cold Brew Coffee Original", "Cold Brew Concentrate Original"],
      positioning: t("โคลด์บรูว์อเนกประสงค์ / เบสกาแฟสำหรับทำที่บ้าน", "All-purpose cold brew / Home café base"),
      difference: t("เป็นรสหลักมาตรฐานของไลน์ และใช้งานได้หลากหลายที่สุด", "The benchmark flavour and most versatile cold-brew option."),
      opsCodes: ["CB-ORIGINAL-500"],
    },
    gaps: ["ราคา", "สต็อก", "ฉลากเขียน \"Cold Brew Coffee\" ส่วน CSV ระบุ Cold Brew Concentrate", "มีแต่ภาพถ่ายพร้อมฉากหลัง ยังไม่มีภาพตัดพื้น"],
  },
  {
    slug: "cold-brew-concentrate-smooth-black",
    name: "Cold Brew Concentrate",
    shortName: "Smooth Black",
    subtitle: "Smooth Black · 500 mL",
    category: "cold-brew",
    // CSV status reads "Current / พัฒนาเป็น SKU หลัก". The site already sold it, so it stays available.
    status: "available",
    published: true,
    images: [{
      file: "cold-brew-concentrate-smooth-black", width: 1024, height: 1536, cutout: true,
      alt: t("ถุง Balena Cold Brew Concentrate Smooth Black 500 มล. มีจุกเกลียว", "Balena Cold Brew Concentrate Smooth Black 500 mL pouch with a screw-cap spout"),
    }],
    size: "500 mL",
    sizeId: "500ml",
    type: "Cold Brew Concentrate",
    flavour: "Smooth Black",
    benefit: t("กาแฟดำนุ่ม คลีน ขมน้อยลง แต่รสกาแฟยังชัด", "Smooth, clean black coffee with less bitterness"),
    story: t(
      "โคลด์บรูว์สำหรับคนชอบกาแฟดำ แต่ต้องการความนุ่มและคลีนมากขึ้น ลดความขมกระแทกโดยยังคงรสกาแฟชัด",
      "A smoother black-coffee expression for people who enjoy cold black coffee but do not want harsh bitterness.",
    ),
    notes: [t("นุ่ม", "Smooth"), t("คลีน", "Clean"), t("ขมน้อยลง", "Less bitter"), t("รสกาแฟชัด", "Coffee-forward")],
    whoFor: t(
      "คนชอบกาแฟดำเย็นที่ไม่อยากได้ความขมกระแทก ตั้งใจทำให้เป็นกาแฟดำที่นุ่มและดื่มง่าย ไม่ใช่ Original ที่เจือจางลง",
      "Cold black-coffee drinkers who want less harsh bitterness. It's made to be a smooth, easy black coffee, not a weaker Original.",
    ),
    drinks: [t("ไอซ์อเมริกาโน", "Iced Americano"), t("โคลด์บรูว์ดำ", "Black cold brew"), t("กาแฟดำใส่น้ำแข็ง", "Coffee on ice")],
    use: COLD_BREW_USE,
    accent: "#1b3c94",
    internal: {
      csvName: "Smooth Black", aliases: ["Cold Brew Concentrate Smooth Black"],
      positioning: t("โคลด์บรูว์กาแฟดำดื่มง่าย", "Easy-drinking black cold brew"),
      difference: t("ไม่ใช่ Original ที่เจือจางกว่า แต่ตั้งใจออกแบบให้เป็นกาแฟดำที่นุ่ม คลีน และดื่มง่าย", "Not simply a weaker Original; it is intentionally positioned around clean, easy-drinking black coffee."),
      opsCodes: ["CB-SMOOTH-500"],
    },
    gaps: ["ราคา", "สต็อก", "สถานะใน CSV: \"Current / พัฒนาเป็น SKU หลัก\" (มีจำหน่ายอยู่แล้ว หรือยังพัฒนา?)"],
  },
  plannedColdBrew({
    slug: "cold-brew-fruity",
    shortName: "Fruity",
    benefit: t("โคลด์บรูว์สายผลไม้ หอมและสดชื่น", "A fruit-forward, refreshing cold brew"),
    story: t(
      "โคลด์บรูว์ที่เพิ่มความหอมและความสดชื่นของผลไม้ เหมาะกับคนที่รู้สึกว่าโคลด์บรูว์แบบดั้งเดิมเข้มหรือขมเกินไป",
      "A more aromatic, refreshing cold brew for customers who find traditional cold brew too dark or bitter.",
    ),
    notes: [t("มิกซ์เบอร์รี่", "Mixed berries"), t("ฟรุตตี้", "Fruity"), t("สดชื่น", "Refreshing")],
    whoFor: t("คนที่รู้สึกว่าโคลด์บรูว์แบบดั้งเดิมเข้มหรือขมเกินไป และอยากได้รสผลไม้สดชื่น", "Anyone who finds traditional cold brew too dark or bitter and wants something fruity and fresh."),
    drinks: [t("กาแฟดำ", "Black"), t("โซดา", "Soda"), t("สปาร์กลิงคอฟฟี่", "Sparkling coffee")],
    internal: {
      csvName: "Fruity", aliases: [],
      positioning: t("โคลด์บรูว์สายผลไม้และความสดชื่น", "Fruity & refreshing cold brew"),
      difference: t("ตัวเลือกสายผลไม้ของไลน์โคลด์บรูว์ แตกต่างจาก Original และ Smooth Black ที่เน้นกาแฟคลาสสิก", "The fruit-forward alternative in the cold-brew family."),
      opsCodes: [],
    },
  }),
  plannedColdBrew({
    slug: "cold-brew-orange",
    shortName: "Orange",
    benefit: t("ออกแบบมาให้ชงคู่กับน้ำส้มที่คุณเติมเอง", "Made to pair with orange juice you add yourself"),
    story: t(
      "โคลด์บรูว์ที่ออกแบบมาให้เข้ากับน้ำส้มโดยเฉพาะ ช่วยให้ทำเมนูสไตล์คาเฟ่ที่สดชื่นได้ง่ายที่บ้าน",
      "A café-style cold brew designed specifically to pair with orange juice for a bright, refreshing drink at home.",
    ),
    notes: [t("กาแฟกับส้ม/ซิตรัส", "Coffee + citrus"), t("สดใส", "Bright"), t("สดชื่น", "Refreshing")],
    whoFor: t("คนชอบกาแฟส้ม ที่อยากทำเมนูสดชื่นสไตล์คาเฟ่ได้เองที่บ้าน", "Orange-coffee fans who want to make a bright café-style drink at home."),
    drinks: [t("อเมริกาโนส้ม", "Orange Americano"), t("โคลด์บรูว์ส้ม", "Orange cold brew"), t("กาแฟซิตรัสโซดา", "Citrus soda coffee")],
    internal: {
      csvName: "Orange", aliases: [],
      positioning: t("เมนูสดชื่นสไตล์คาเฟ่ / ตัวหลักสำหรับกาแฟส้ม", "Refreshing café-style / Orange coffee specialist"),
      difference: t("เป็น SKU ที่มีเมนูเป้าหมายชัดเจนที่สุด วางมาเพื่อกาแฟส้มโดยเฉพาะ", "The clearest occasion-led SKU: built for orange coffee rather than general-purpose mixing."),
      opsCodes: [],
    },
  }),
  plannedColdBrew({
    slug: "cold-brew-vanilla",
    shortName: "Vanilla",
    benefit: t("วานิลลานุ่ม เข้ากับนมและโอ๊ตมิลค์", "Soft vanilla that suits milk and oat milk"),
    story: t(
      "โคลด์บรูว์กลิ่นวานิลลานุ่ม\u00A0ๆ ให้ความรู้สึกละมุน ดื่มง่าย โดยเฉพาะเมื่อเติมนมหรือโอ๊ตมิลค์ และยังใช้ทำกาแฟดำหอมหวานได้",
      "A soft, comforting flavoured cold brew that becomes especially appealing with milk or oat milk while remaining usable as a sweet-aromatic black coffee.",
    ),
    notes: [t("วานิลลานุ่ม", "Soft vanilla"), t("หอมละมุน", "Smooth"), t("ดื่มง่าย", "Comforting")],
    whoFor: t("คนชอบกาแฟนมหรือกาแฟโอ๊ตมิลค์ ที่อยากได้กลิ่นวานิลลานุ่มละมุน มากกว่าความเปรี้ยวของผลไม้", "Milk and oat-milk coffee drinkers who like a soft vanilla aroma rather than fruity acidity."),
    drinks: [t("กาแฟนมวานิลลา", "Vanilla milk coffee"), t("กาแฟโอ๊ตมิลค์", "Oat milk coffee"), t("กาแฟดำวานิลลา", "Vanilla black"), t("เมนูสไตล์ลาเต้", "Latte-style drinks")],
    internal: {
      csvName: "Vanilla", aliases: [],
      positioning: t("นุ่มละมุน / เหมาะกับกาแฟนม", "Soft & comforting / Milk-friendly"),
      difference: t("เป็นรสปรุงแต่งที่เข้าถึงง่ายที่สุด เน้นความละมุนและความคุ้นเคยมากกว่าความเปรี้ยวผลไม้", "The most mass-friendly flavoured cold brew, focused on comfort rather than fruit acidity."),
      opsCodes: [],
    },
  }),

  // ---------- Coffee beans ----------
  bean({
    slug: "brazil-santos", name: "Brazil Santos", size: 200, accent: "#6b3e26",
    images: [bag("brazil-santos", bagAlt("Brazil Santos", 200))],
    process: "Natural Process", altitude: "800–1,300 masl.",
    roast: { value: t("กลางค่อนเข้ม", "Medium-dark"), direction: true },
    benefit: t("ดื่มง่ายทุกวัน หวานแบบช็อกโกแลตและถั่ว", "Easy everyday coffee with chocolate-and-nut sweetness"),
    story: t(
      "กาแฟโทนหวานและคุ้นเคย ดื่มง่าย ความหวานแบบน้ำตาลทรายแดงตามด้วยช็อกโกแลตและเฮเซลนัท ให้รสกลมกล่อมและไม่เปรี้ยวโดด",
      "A sweet, familiar and comforting coffee. Brown-sugar sweetness leads into chocolate and roasted hazelnut, giving a rounded cup with approachable acidity.",
    ),
    notes: [t("น้ำตาลทรายแดง", "Brown sugar"), t("ช็อกโกแลต", "Chocolate"), t("เฮเซลนัท", "Hazelnut")],
    whoFor: t(
      "คนที่เพิ่งเริ่มเลือกเมล็ดกาแฟ หรืออยากได้กาแฟรสคุ้นเคยที่ชงได้หลายเมนูและถูกใจคนส่วนใหญ่",
      "New to choosing beans, or after a familiar coffee that works in many drinks and suits most tastes.",
    ),
    drinks: [t("อเมริกาโน", "Americano"), t("เอสเปรสโซ", "Espresso"), t("ลาเต้", "Latte"), t("คาปูชิโน", "Cappuccino"), t("มอคค่า", "Mocha")],
    internal: {
      csvName: "Brazil Santos", aliases: ["Brasil Santos"],
      positioning: t("กาแฟดื่มทุกวัน / ตัวเริ่มต้นสำหรับลูกค้าใหม่", "Everyday crowd-pleaser / Entry coffee"),
      difference: t("เป็นตัวเริ่มต้นที่เข้าถึงง่ายที่สุดของ Balena รสคุ้นเคย ชงได้หลากหลายและถูกใจคนส่วนใหญ่", "The easiest entry point in the Balena range; familiar, versatile and broadly appealing."),
      opsCodes: ["BN-SANTOS-200"],
    },
    extraGaps: ["ระดับการคั่ว: CSV ให้เป็นแนวทาง (Medium-dark direction) ฉลากมีแต่แถบสี", "ชื่อไฟล์สะกด Brasil"],
  }),
  bean({
    slug: "brazil-cerrado", name: "Brazil Cerrado", size: 200, accent: "#b8873c",
    images: [bag("brazil-cerrado", bagAlt("Brazil Cerrado", 200))],
    process: "Semi-washed", altitude: "1,000–1,300 masl.", roast: MEDIUM_DARK,
    benefit: t("นุ่ม ละมุน ดื่มสบายทุกวัน", "Softer, smoother everyday coffee"),
    story: t(
      "กาแฟบราซิลที่เน้นความนุ่ม ช็อกโกแลตและเฮเซลนัทเด่น ปลายรสหวานและกลมกล่อม ไม่หนักจนเกินไป",
      "A smooth Brazilian profile with chocolate and hazelnut at the centre, finishing softer and rounder than a heavy dark roast.",
    ),
    notes: [t("ช็อกโกแลต", "Chocolate"), t("เฮเซลนัท", "Hazelnut"), t("หวานนุ่ม กลมกล่อม", "Sweet & smooth")],
    whoFor: t(
      "คนที่อยากได้กาแฟเข้มกำลังดีแต่ดื่มสบาย นุ่มและละมุนกว่า Brazil Santos",
      "Anyone who wants a medium-strength coffee that's easy to drink, softer and smoother than Brazil Santos.",
    ),
    drinks: [t("อเมริกาโน", "Americano"), t("แฟลตไวท์", "Flat White"), t("ลาเต้", "Latte"), t("กาแฟเย็น", "Iced coffee")],
    internal: {
      csvName: "Brazil Cerrado", aliases: ["Brasil Cerrado"],
      positioning: t("กาแฟนุ่ม ดื่มง่ายทุกวัน", "Smooth everyday coffee"),
      difference: t("นุ่มและละมุนกว่า Santos เหมาะกับคนที่อยากได้กาแฟเข้มกำลังดีแต่ดื่มสบาย", "Smoother and softer than Santos; designed for customers who prioritise an easy finish."),
      opsCodes: ["BN-CERRADO-200"],
    },
    extraGaps: ["ชื่อไฟล์สะกด Brasil"],
  }),
  bean({
    slug: "laos-bolaven", name: "Laos Bolaven", size: 200, accent: "#d98a5f",
    images: [bag("laos-bolaven", bagAlt("Laos Bolaven", 200))],
    process: "Washed Process", altitude: "1,100–1,300 masl.", roast: MEDIUM_DARK,
    benefit: t("บอดี้แน่น รสกาแฟยังชัดแม้เติมนม", "Bold body that stays clear in milk"),
    story: t(
      "กาแฟบอดี้แน่น โทนดาร์กช็อกโกแลตและถั่ว รสกาแฟยังชัดแม้เติมนม เหมาะกับคนที่ชอบกาแฟเข้มเต็มคำ",
      "Rich, full-bodied coffee with dark chocolate and nutty depth. Its structure stays clear even after adding milk.",
    ),
    notes: [t("ดาร์กช็อกโกแลต", "Dark chocolate"), t("ถั่ว", "Nutty"), t("บอดี้แน่น", "Full body")],
    whoFor: t(
      "คนชอบกาแฟนมที่ยังอยากให้รสกาแฟเด่น หรือคนที่ชอบกาแฟเข้มรสชัด บอดี้มากกว่ากลุ่มบราซิล",
      "Milk-coffee drinkers who still want the coffee to come through, and fans of bold coffee. More body than our Brazilian coffees.",
    ),
    drinks: [t("ลาเต้", "Latte"), t("คาปูชิโน", "Cappuccino"), t("ไอซ์ลาเต้", "Iced latte"), t("กาแฟนมสไตล์ไทย", "Thai-style milk coffee")],
    internal: {
      csvName: "Laos Bolaven", aliases: ["Lao Bolaven", "Bolaven"],
      positioning: t("กาแฟเข้มสำหรับเมนูนม / คนชอบกาแฟรสชัด", "Bold milk-coffee / Traditional strong coffee"),
      difference: t("บอดี้และความเข้มมากกว่ากลุ่มบราซิล เหมาะกับเมนูนมที่ต้องการให้รสกาแฟยังเด่น", "More body and intensity than the Brazilian coffees; especially strong in milk drinks."),
      opsCodes: ["BN-BOLAVEN-200"],
    },
  }),
  bean({
    slug: "milk-choc", name: "Milk Choc", size: 200, accent: "#8a5a3c",
    images: [bag("milk-choc", bagAlt("Milk Choc", 200))],
    process: "Washed Process", altitude: "1,100–1,300 masl.", roast: MEDIUM_DARK,
    benefit: t("ตัวเลือกหลักสำหรับคนชอบกาแฟนม", "Our first pick for milk coffee"),
    story: t(
      "คาแรกเตอร์นุ่มหวานแบบของหวาน มีเฮเซลนัท ดาร์กช็อกโกแลต และคาราเมล เป็นกาแฟที่จับคู่กับนมได้อย่างเป็นธรรมชาติ",
      "A creamy, dessert-like profile built around hazelnut, dark chocolate and caramel. Easy to understand and naturally suited to milk.",
    ),
    notes: [t("เฮเซลนัท", "Hazelnut"), t("ดาร์กช็อกโกแลต", "Dark chocolate"), t("คาราเมล", "Caramel")],
    whoFor: t(
      "คนที่ดื่มกาแฟนมเป็นหลัก และชอบรสหวานละมุนแบบของหวาน",
      "People who mostly drink milk coffee and like a sweet, dessert-like profile.",
    ),
    drinks: [t("ลาเต้", "Latte"), t("ไอซ์ลาเต้", "Iced latte"), t("คาปูชิโน", "Cappuccino"), t("มอคค่า", "Mocha")],
    internal: {
      csvName: "Milk Choc", aliases: [],
      positioning: t("ตัวเลือกหลักสำหรับคนชอบกาแฟนม", "Milk-coffee specialist"),
      difference: t("ให้ความรู้สึกหวานละมุนและเป็นของหวานมากกว่า Laos หรือ Brazil และมีจุดยืนเรื่องกาแฟนมชัดที่สุด", "Sweeter and more indulgent in perception than Laos or Brazil; the clearest milk-coffee specialist."),
      opsCodes: ["BN-MILKCHOC-200"],
    },
    extraGaps: ["แหล่งที่มา"],
  }),
  bean({
    // Slug and image files keep the old label spelling "House Blends"; the product name is "House Blend".
    slug: "house-blends", name: "House Blend", size: 200, accent: "#2f5d7c",
    images: [
      bag("house-blends", t("ถุงเมล็ดกาแฟ Balena House Blends 200 กรัม", "Bag of Balena House Blends coffee beans, 200 g")),
      { file: "house-blends-alt", width: 1254, height: 1254, cutout: false,
        alt: t("ถุง Balena House Blends 200 กรัม บนพื้นขาว", "Balena House Blends 200 g bag on a white background") },
    ],
    process: "Dry & Wash", altitude: "1,100–1,300 masl.", roast: MEDIUM_DARK,
    benefit: t("ชงได้ดีทั้งกาแฟดำและกาแฟนม", "Works for both black and milk coffee"),
    story: t(
      "เบลนด์ประจำร้านที่ให้โทนช็อกโกแลตและถั่วแบบคุ้นเคย ปลายรสนุ่ม ชงได้ดีทั้งกาแฟดำและกาแฟนม",
      "A reliable house coffee with familiar chocolate-nut flavours and a smooth finish, designed to work across black and milk drinks.",
    ),
    notes: [t("เฮเซลนัท", "Hazelnut"), t("ดาร์กช็อกโกแลต", "Dark chocolate"), t("นุ่มสมดุล", "Smooth")],
    whoFor: t(
      "บ้านที่ชงทั้งกาแฟดำและกาแฟนม และอยากได้เมล็ดเดียวที่ใช้ได้กับหลายวิธีชง",
      "Homes that make both black and milk coffee and want one bean for many brewing styles.",
    ),
    drinks: [t("เอสเปรสโซ", "Espresso"), t("อเมริกาโน", "Americano"), t("ลาเต้", "Latte"), t("คาปูชิโน", "Cappuccino")],
    internal: {
      csvName: "House Blend", aliases: ["House Blends"],
      positioning: t("กาแฟอเนกประสงค์ / ตัวประจำบ้าน", "All-rounder / Reliable house coffee"),
      difference: t("ไม่เจาะจงเมนูนมเท่า Milk Choc แต่ยืดหยุ่นกว่าและใช้ได้กับหลายวิธีชง", "Less specialised than Milk Choc and more versatile across brewing styles."),
      opsCodes: ["BN-HOUSE-200"],
    },
    extraGaps: ["แหล่งที่มาของเบลนด์", "ฉลากบนถุงยังเขียน House Blends"],
  }),
  bean({
    slug: "52hz-signature-blend", name: "52 Hz. Signature Blend", shortName: "52 Hz.", size: 200, accent: "#1f9fb8",
    images: [bag("52hz-signature-blend", t("ถุงเมล็ดกาแฟ Balena 52 Hz. Signature Blend 200 กรัม", "Bag of Balena 52 Hz. Signature Blend coffee beans, 200 g"))],
    type: "Signature Blend",
    roast: { value: t("กลาง", "Medium"), direction: true },
    benefit: t("ซิกเนเจอร์ของ Balena มีมิติแต่ยังดื่มง่าย", "Balena's signature: layered yet approachable"),
    story: t(
      "กาแฟซิกเนเจอร์ของ Balena ฐานรสช็อกโกแลต เฮเซลนัท และโกโก้ ให้ความหวานสมดุล พร้อมซิตรัสอ่อน\u00A0ๆ เพิ่มมิติแต่ไม่เปรี้ยวโดด",
      "Balena's signature cup: a comforting chocolate-hazelnut base with cocoa sweetness and a subtle citrus lift that adds complexity without becoming sharply fruity.",
    ),
    notes: [t("ดาร์กช็อกโกแลต", "Dark chocolate"), t("เฮเซลนัท", "Hazelnut"), t("โกโก้", "Cocoa"), t("หวานสมดุล", "Sweet balance"), t("ซิตรัสอ่อน\u00A0ๆ", "Mild citrus")],
    whoFor: t(
      "คนที่อยากรู้จักรสชาติประจำแบรนด์ Balena กาแฟที่มีมิติมากกว่าเบลนด์ดื่มง่ายทั่วไป แต่ยังดื่มได้ทุกวัน",
      "Anyone who wants to taste Balena's house style: more layered than our everyday blends, yet still easy to drink every day.",
    ),
    drinks: [t("เอสเปรสโซ", "Espresso"), t("อเมริกาโน", "Americano"), t("แฟลตไวท์", "Flat White"), t("พัวร์โอเวอร์", "Pour-over")],
    internal: {
      csvName: "52 Hz. Signature Blend", aliases: ["52 Hz.", "52 Hz", "52Hz"],
      positioning: t("ซิกเนเจอร์ของ Balena / กาแฟพรีเมียมดื่มทุกวัน", "Balena Signature / Premium everyday"),
      difference: t("มีมิติมากกว่าเบลนด์ดื่มง่ายทั่วไป แต่ยังเข้าถึงง่าย เหมาะเป็นตัวแทนรสชาติของแบรนด์ Balena", "More layered than the everyday blends while remaining approachable; the clearest expression of Balena's house identity."),
      opsCodes: ["BN-52HZ-200"],
    },
    extraGaps: [
      "แหล่งที่มาของเบลนด์",
      "รูปถุงพิมพ์ Red Honey · 1,300–1,500 masl. · Red grape, Floral, Wine · Medium Light ซึ่งตาม CSV เป็นข้อมูลของ Vino Rosso: ต้องใช้รูปถุงใหม่",
    ],
  }),
  bean({
    slug: "kenya-muranga", name: "Kenya Muranga", size: 200, accent: "#c8323a",
    images: [bag("kenya-muranga", bagAlt("Kenya Muranga", 200))],
    process: "Washed Process", altitude: "1,700–2,200 masl.", roast: LIGHT,
    benefit: t("สดใส เบอร์รี่และซิตรัสเด่น", "Bright berries and citrus"),
    story: t(
      "กาแฟผลไม้สดใส มิกซ์เบอร์รี่และซิตรัสเด่น มีดาร์กช็อกโกแลตช่วยเสริมโครงสร้างให้รสไม่บาง",
      "A lively, fruit-forward coffee where mixed berries and citrus lead, supported by a darker chocolate backbone.",
    ),
    notes: [t("มิกซ์เบอร์รี่", "Mixed berries"), t("ซิตรัส", "Citrus"), t("ดาร์กช็อกโกแลต", "Dark chocolate")],
    whoFor: t(
      "คนชอบกาแฟผลไม้สดใส มีความเปรี้ยวชัด มากกว่าโทนช็อกโกแลตและถั่ว",
      "Fans of bright, fruity coffee with clear acidity rather than chocolate and nut tones.",
    ),
    drinks: [t("พัวร์โอเวอร์", "Pour-over"), t("ไอซ์อเมริกาโน", "Iced Americano"), t("แฟลชบริว", "Flash brew"), t("เอสเปรสโซโทนิก", "Espresso tonic")],
    internal: {
      csvName: "Kenya Muranga", aliases: ["Kenya Murang'a"],
      positioning: t("กาแฟสเปเชียลตี้สายฟรุตตี้", "Bright specialty / Fruity explorer"),
      difference: t("สดใสและมีกรดผลไม้ชัดกว่ากลุ่มช็อกโกแลตและถั่วอย่างชัดเจน", "Clearly brighter and more acidic than the chocolate-and-nut range."),
      opsCodes: ["BN-KENYA-200"],
    },
    extraGaps: ["สะกด Muranga หรือ Murang'a"],
  }),
  bean({
    slug: "blue-magic", name: "Blue Magic", size: 100, accent: "#4c5fb0",
    images: [bag("blue-magic", bagAlt("Blue Magic", 100))],
    process: "Anaerobic", altitude: "1,100–1,300 masl.", roast: LIGHT,
    benefit: t("บลูเบอร์รี่ แยม และสัมผัสคล้ายวานิลลาชีสเค้ก", "Blueberry, jam and vanilla-cheesecake impressions"),
    story: t(
      "กาแฟสายสนุกและหอมชัด ให้บลูเบอร์รี่และแยมเด่น ตามด้วยความรู้สึกนุ่มหวานคล้ายวานิลลาชีสเค้ก",
      "A playful aromatic coffee with vivid blueberry and jam-like fruit, followed by a creamy vanilla-cheesecake impression.",
    ),
    notes: [t("บลูเบอร์รี่", "Blueberry"), t("วานิลลาชีสเค้ก", "Vanilla cheesecake"), t("แยม", "Jam")],
    whoFor: t(
      "คนชอบลองรสชาติใหม่ ที่อยากได้กาแฟกลิ่นผลไม้แบบของหวาน หอมชัดและจำง่าย",
      "Adventurous drinkers looking for a memorable coffee with dessert-like fruit aromas.",
    ),
    drinks: [t("พัวร์โอเวอร์", "Pour-over"), t("กาแฟดำเย็น", "Iced black"), t("สปาร์กลิงคอฟฟี่", "Sparkling coffee"), t("เอสเปรสโซโทนิก", "Espresso tonic")],
    internal: {
      csvName: "Blue Magic", aliases: [],
      positioning: t("กาแฟสนุกสำหรับคนชอบลองรสชาติใหม่", "Fun specialty / Adventurous coffee"),
      difference: t("เป็นหนึ่งในกาแฟที่มีคาแรกเตอร์ผลไม้แบบของหวานชัดที่สุด จำง่ายและเล่าเรื่องบนโซเชียลได้ดี", "One of the most distinctive dessert-fruity coffees in the range; memorable and social-media friendly."),
      opsCodes: ["BN-BLUEMAGIC-100"],
    },
    extraGaps: ["แหล่งที่มา"],
  }),
  bean({
    slug: "whiskey", name: "Whiskey", size: 100, accent: "#b9772a",
    images: [bag("whiskey", bagAlt("Whiskey", 100))],
    process: "Anaerobic Process", altitude: "1,200–1,400 masl.", roast: LIGHT,
    benefit: t("อโรมาคล้ายวิสกี้ วานิลลา และน้ำผึ้ง", "Whiskey-like aroma with vanilla and honey"),
    story: t(
      "กาแฟทดลองที่เน้นอโรมาหอมอุ่นคล้ายวิสกี้ ผสานวานิลลาและความหวานแบบน้ำผึ้ง จุดเด่นคือประสบการณ์กลิ่นรสที่ไม่เหมือนกาแฟทั่วไป",
      "A warm, aromatic experimental coffee built around whiskey-like fragrance, vanilla and honey sweetness. Its appeal is sensory novelty rather than heaviness.",
    ),
    notes: [t("อโรมาคล้ายวิสกี้", "Whiskey-like aroma"), t("วานิลลา", "Vanilla"), t("น้ำผึ้ง", "Honey")],
    whoFor: t(
      "คนที่อยากลองประสบการณ์กลิ่นรสแปลกใหม่ หรือกำลังมองหากาแฟเป็นของขวัญ มากกว่ากาแฟรสคลาสสิกประจำวัน",
      "Anyone curious about an unusual aroma, or looking for a coffee gift rather than a classic everyday cup.",
    ),
    drinks: [t("พัวร์โอเวอร์", "Pour-over"), t("กาแฟดำ", "Black coffee"), t("กาแฟดำเย็น", "Iced black")],
    internal: {
      csvName: "Whiskey", aliases: ["Whisky"],
      positioning: t("กาแฟทดลอง / ของขวัญ / ตัวสร้างบทสนทนา", "Experimental / Gift / Conversation coffee"),
      difference: t("เหมาะเป็นกาแฟสร้างประสบการณ์และของขวัญ มากกว่าการวางเป็นกาแฟรสคลาสสิกประจำวัน", "A conversation coffee and gift choice rather than an everyday traditional profile."),
      opsCodes: ["BN-WHISKEY-100"],
    },
    extraGaps: ["แหล่งที่มา", "กฎแพลตฟอร์มเรื่องคำเกี่ยวกับแอลกอฮอล์"],
  }),
  bean({
    slug: "vino-rosso", name: "Vino Rosso", size: 100, accent: "#a8253a",
    // First published as a 200 g item; the Meta catalog id stays the same so Meta keeps its history.
    catalogId: "vino-rosso-200g",
    images: [bag("vino-rosso", t("ถุงเมล็ดกาแฟ Balena Vino Rosso", "Bag of Balena Vino Rosso coffee beans"))],
    process: "Red Honey", altitude: "1,300–1,500 masl.", roast: { value: t("กลางค่อนอ่อน", "Medium-light") },
    benefit: t("องุ่นแดง ดอกไม้ และคาแรกเตอร์คล้ายไวน์", "Red grape, floral and wine-like character"),
    story: t(
      "กาแฟหอมมีความหรู โทนองุ่นแดงและดอกไม้เด่น พร้อมคาแรกเตอร์คล้ายไวน์และปลายรสละเอียด",
      "An elegant aromatic coffee led by red grape and floral notes with a wine-like character and refined finish.",
    ),
    notes: [t("องุ่นแดง", "Red grape"), t("ดอกไม้", "Floral"), t("คาแรกเตอร์คล้ายไวน์", "Wine-like")],
    whoFor: t(
      "คนที่ชอบกาแฟหอม มีมิติ สไตล์คล้ายไวน์ มากกว่าความหวานแบบของหวานของ Blue Magic",
      "Drinkers who prefer an elegant, aromatic, wine-like cup over the dessert-style sweetness of Blue Magic.",
    ),
    drinks: [t("พัวร์โอเวอร์", "Pour-over"), t("กาแฟดำเย็น", "Iced black"), t("สปาร์กลิงคอฟฟี่", "Sparkling coffee")],
    internal: {
      csvName: "Vino Rosso", aliases: [],
      positioning: t("กาแฟพรีเมียมสายอโรมาติก / สไตล์ไวน์", "Premium aromatic / Wine-style specialty"),
      difference: t("ให้ความรู้สึกหรูและคล้ายไวน์มากกว่า Blue Magic ไม่หวานแบบของหวาน แต่เน้นความหอมและมิติ", "More refined and wine-like than Blue Magic; less dessert-like and more aromatic."),
      opsCodes: ["BN-VINO-100"],
    },
    extraGaps: [
      "แหล่งที่มา",
      "รูปถุงพิมพ์ NET WT 200 G และข้อมูลของ Brazil Santos (Natural · 800–1,300 · Brown sugar, Chocolate, Hazelnut) แต่ CSV และระบบหลังร้านระบุ 100 กรัม Red Honey: ต้องใช้รูปถุงใหม่",
      "Meta catalog id ยังเป็น vino-rosso-200g ตามที่เผยแพร่ครั้งแรก",
    ],
  }),
  bean({
    slug: "florange", name: "Florange", size: 200, accent: OCEAN, batchDependent: true,
    benefit: t("สดชื่น โทนดอกไม้และซิตรัส", "Refreshing floral and citrus character"),
    story: t(
      "กาแฟโทนสดใสและสดชื่น เน้นกลิ่นดอกไม้และส้ม/ซิตรัส ให้ความรู้สึกเบาและมีชีวิตชีวามากกว่ากลุ่มช็อกโกแลต",
      "A bright, refreshing profile built around floral aroma and orange-citrus character, designed to feel lively rather than heavy.",
    ),
    notes: [t("ดอกไม้", "Floral"), t("ส้ม/ซิตรัส", "Orange/citrus"), t("สดชื่น", "Refreshing")],
    whoFor: t(
      "คนที่ชอบกาแฟสดชื่น เบาสบาย โทนดอกไม้และส้ม ต่างจาก Blue Magic และ Kenya ที่เน้นเบอร์รี่",
      "Anyone who likes a light, refreshing cup with floral and orange notes, unlike the berry-led Blue Magic and Kenya.",
    ),
    drinks: [t("พัวร์โอเวอร์", "Pour-over"), t("ไอซ์อเมริกาโน", "Iced Americano"), t("กาแฟส้ม", "Orange coffee"), t("สปาร์กลิงคอฟฟี่", "Sparkling coffee")],
    internal: {
      csvName: "Florange", aliases: [],
      positioning: t("กาแฟสเปเชียลตี้สายซิตรัสสดชื่น", "Refreshing citrus specialty"),
      difference: t("เป็นตัวแทนกลุ่มซิตรัสสดชื่น แตกต่างจาก Blue Magic และ Kenya ที่เน้นเบอร์รี่และผลไม้คนละแบบ", "Owns the citrus-refreshing territory in the range, distinct from berry-led Blue Magic and Kenya."),
      opsCodes: ["BN-FLORANGE-200"],
    },
    extraGaps: ["กระบวนการและระดับการคั่วขึ้นอยู่กับล็อต", "ขนาดในระบบหลังร้านยังไม่ยืนยัน (size_confirmed = false)"],
  }),
  bean({
    slug: "ethiopia-gediyo", name: "Ethiopia Gediyo", size: 100, accent: OCEAN, batchDependent: true,
    benefit: t("หอมละเอียด เน้นเอกลักษณ์แหล่งปลูก", "Delicate and origin-focused"),
    story: t(
      "กาแฟสเปเชียลตี้ที่เน้นเอกลักษณ์แหล่งปลูก ความหอมและความละเอียด โน้ตรสชาติอาจต่างกันไปในแต่ละล็อตคั่ว",
      "An origin-led specialty coffee built around aroma, delicacy and discovery. Tasting notes can differ from one roast batch to the next.",
    ),
    notes: [t("หอม", "Aromatic"), t("ละเอียด", "Delicate"), t("เน้นเอกลักษณ์แหล่งปลูก", "Origin-driven")],
    whoFor: t(
      "คนชอบกาแฟสเปเชียลตี้ ที่อยากสำรวจเอกลักษณ์ของแหล่งปลูก มากกว่ากาแฟชื่อรสชาติแบบของหวาน",
      "Specialty-coffee fans who enjoy exploring origin character more than dessert-style flavours.",
    ),
    drinks: [t("พัวร์โอเวอร์", "Pour-over"), t("ฟิลเตอร์", "Filter coffee"), t("กาแฟดำเย็น", "Iced black")],
    internal: {
      csvName: "Ethiopia Gediyo", aliases: ["Etiopia Gediyo", "Gediyo"],
      positioning: t("กาแฟสำรวจแหล่งปลูก / สำหรับสายสเปเชียลตี้", "Origin discovery / Specialty enthusiast"),
      difference: t("เน้นเรื่องแหล่งปลูกและความละเอียดมากกว่ากลุ่มกาแฟชื่อรสชาติแบบของหวาน", "More origin-focused and delicate than the dessert-style named coffees."),
      // BN-GEDIYO-200 ("Etiopia Gediyo 200 g") is the older 200 g variant with an ICONSIAM sale:
      // a different package, kept as it is. This 100 g bag has no operations item yet.
      opsCodes: [],
    },
    extraGaps: [
      "ขนาดขัดกัน: CSV 100 กรัม แต่ระบบหลังร้านมี BN-GEDIYO-200 (200 กรัม, ยังไม่ยืนยัน) ที่มียอดขาย ICONSIAM แล้ว: เก็บ 200 กรัมไว้เป็นอีกขนาด",
      "โน้ตรสชาติของล็อตปัจจุบัน",
    ],
  }),
  bean({
    slug: "colombia-supremo", name: "Colombia Supremo", size: 200, accent: OCEAN, batchDependent: true,
    benefit: t("สมดุล เชื่อมโทนช็อกโกแลตกับผลไม้", "A balanced bridge between chocolate and fruit"),
    story: t(
      "กาแฟแหล่งปลูกที่สมดุล อยู่กึ่งกลางระหว่างความคุ้นเคยของช็อกโกแลตกับความสดใสแบบสเปเชียลตี้ เหมาะสำหรับคนที่อยากขยับจากกาแฟดื่มง่ายไปสู่รสที่มีมิติมากขึ้น",
      "A balanced origin coffee that sits between familiar chocolate comfort and brighter specialty character, making it an easy step up from everyday coffee.",
    ),
    notes: [t("หวานสมดุล", "Balanced sweetness"), t("ช็อกโกแลตสู่ผลไม้", "Chocolate to fruit")],
    whoFor: t(
      "คนที่อยากขยับจากกาแฟดื่มง่ายประจำวัน ไปลองรสที่มีมิติและสดใสขึ้นอีกนิด",
      "Anyone ready to step up from everyday coffee to a cup with a little more brightness and dimension.",
    ),
    drinks: [t("อเมริกาโน", "Americano"), t("เอสเปรสโซ", "Espresso"), t("พัวร์โอเวอร์", "Pour-over"), t("ลาเต้", "Latte")],
    internal: {
      csvName: "Colombia Supremo", aliases: [],
      positioning: t("กาแฟแหล่งปลูกสมดุล / อัปเกรดจากกาแฟประจำวัน", "Balanced origin / Everyday upgrade"),
      difference: t("เป็นสะพานเชื่อมระหว่างกาแฟโทนคุ้นเคยกับกาแฟฟรุตตี้สเปเชียลตี้", "A bridge between comfort coffees and fruit-forward specialty coffees."),
      opsCodes: [],
    },
    extraGaps: ["ยังไม่มีรายการในระบบหลังร้าน", "กระบวนการและระดับการคั่วขึ้นอยู่กับล็อต"],
  }),
  bean({
    slug: "robusta", name: "Robusta", size: 150, accent: OCEAN, batchDependent: true,
    benefit: t("บอดี้หนัก รสกาแฟเข้มชัด", "Strong body, intense coffee character"),
    story: t(
      "กาแฟที่วางจุดขายเรื่องความเข้ม บอดี้หนัก และรสกาแฟชัด เหมาะกับเมนูเย็นหรือนมที่ต้องการให้กาแฟยังเด่น",
      "A strength-led coffee for customers who want unmistakable coffee intensity, heavy body and a powerful presence in iced or milk drinks.",
    ),
    notes: [t("บอดี้หนัก", "Strong body"), t("รสกาแฟเข้มชัด", "Intense coffee"), t("เน้นความเข้มมากกว่าผลไม้", "Low fruit emphasis")],
    whoFor: t(
      "คนชอบกาแฟเข้ม บอดี้แน่น ที่อยากให้รสกาแฟเด่นในเมนูเย็นและกาแฟนม เป็นตัวที่เข้มที่สุดของเรา",
      "Anyone who wants strong, heavy-bodied coffee that stands out in iced and milk drinks. Our strongest option.",
    ),
    drinks: [t("กาแฟเย็นไทย", "Thai iced coffee"), t("อเมริกาโนเย็นเข้ม", "Strong iced Americano"), t("กาแฟนม", "Milk coffee"), t("ใช้ทำเบลนด์", "Blends")],
    internal: {
      csvName: "Robusta", aliases: [],
      positioning: t("กาแฟสายเข้ม / คนชอบบอดี้แน่น", "Strong coffee / Body seeker"),
      difference: t("เป็นตัวเลือกที่เน้นความเข้มและบอดี้มากที่สุด ไม่ได้วางจุดขายหลักที่กลิ่นผลไม้แบบสเปเชียลตี้", "The strongest, body-first option in the portfolio rather than an aroma-led specialty coffee."),
      opsCodes: ["BN-ROBUSTA-150"],
    },
    extraGaps: ["กระบวนการและระดับการคั่วขึ้นอยู่กับล็อต"],
  }),
];

/** Products shown on the site. */
export const products: Product[] = allProducts.filter((p) => p.published);

export const CATEGORIES: { id: Category; anchor: string }[] = [
  { id: "cold-brew", anchor: "cold-brew" },
  { id: "beans", anchor: "coffee-beans" },
];

export const bySlug = (slug: string | null | undefined) => products.find((p) => p.slug === slug) ?? null;
export const inCategory = (c: Category) => products.filter((p) => p.category === c);
export const anchorOf = (c: Category) => CATEGORIES.find((x) => x.id === c)!.anchor;
/** Purchase buttons only for products on sale. */
export const purchasable = (p: Product) => p.status === "available";

/** Catalogue address for one product: selects it and scrolls to its section. */
export const productHref = (p: Product) => `/products?p=${p.slug}#${anchorOf(p.category)}`;

export type FactKey = "type" | "flavour" | "size" | "roast" | "roastDirection" | "process" | "altitude" | "form" | "batch";

/** The product's process and roast rows, in display order. Only confirmed fields. */
export function factsOf(p: Product, lang: Lang): { key: FactKey; value: string; en: boolean }[] {
  const rows: [FactKey, string | T | undefined][] = [
    ["type", p.type], ["flavour", p.flavour], ["size", p.size],
    [p.roast?.direction ? "roastDirection" : "roast", p.roast?.value],
    ["process", p.process], ["altitude", p.altitude], ["form", p.form],
  ];
  return rows.flatMap(([key, v]) => {
    if (!v) return [];
    // Label values are printed in English; translated values follow the page language.
    return typeof v === "string" ? [{ key, value: v, en: true }] : [{ key, value: v[lang], en: lang === "en" }];
  });
}
