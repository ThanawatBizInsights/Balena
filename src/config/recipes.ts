// Recipe quantities and copy. Edit this file after taste-testing; the page text,
// the recipe cards' ratio bars and the animations all read from it.
//
// These are suggested starter recipes, not verified official formulas.
//
// Every customer-facing text is written in Thai and English ({ th, en }); `npm run check:i18n`
// fails if one is missing. Components get plain strings through recipesFor(lang).

export type LiquidKind = "coldbrew" | "water" | "milk" | "soda" | "orange";

/** A string in both languages. */
type T = { th: string; en: string };
export type Lang = keyof T;

export type Ingredient = {
  id: string;
  name: string;
  /** Short name on the animation's chips (defaults to the name). */
  short?: string;
  /** Shown to customers, e.g. "50 มล." or "ตามชอบ". */
  amount: string;
  /** Liquid volume before ice, used for ratio bars and the animated fill level. */
  ml?: number;
  /** How the animation draws it. Omit for things the animation doesn't pour. */
  kind?: LiquidKind | "ice";
  optional?: boolean;
};

export type Pour = {
  ingredientId: string;
  /** Caption shown in the animation while this ingredient is poured. */
  caption: string;
};

export type Photo = {
  /** Path inside public/, e.g. "images/drink-black.jpg". Leave empty until the photo exists. */
  src: string;
  alt: string;
  /** The photo's real pixel size, so the browser reserves the right space. */
  width: number;
  height: number;
};

export type Recipe = {
  id: string;
  name: string;
  summary: string;
  /** Optional photo of the finished drink, shown above the ingredients. */
  photo?: Photo;
  ingredients: Ingredient[];
  steps: [string, string, string];
  /** The two liquids in the order they go into the glass (after the ice). */
  pours: [Pour, Pour];
  mixCaption: string;
  /** Colour of the finished drink after mixing. */
  mixedColor: string;
  bubbles?: boolean;
  /** Fixed wording inside the animation, in the page language. */
  scene: SceneText;
};

export type SceneText = { prepare: string; ice: string; ready: string; end: string; optional: string };

// Wording inside every animation.
const SCENE: Record<Lang, SceneText> = {
  th: { prepare: "เตรียมส่วนผสม", ice: "ใส่น้ำแข็ง", ready: "พร้อมดื่ม", end: "ปรับความเข้มได้ตามชอบ", optional: "ไม่ใส่ก็ได้" },
  en: { prepare: "Get ready", ice: "Add ice", ready: "Ready to drink", end: "Adjust the strength to taste", optional: "optional" },
};

export const STARTER_NOTE: T = {
  th: "สูตรเริ่มต้นสำหรับทดลองชง สามารถปรับสัดส่วนตามรสชาติที่ชอบ",
  en: "A starter recipe to try. Adjust the proportions to your taste.",
};

export const liquidColors: Record<LiquidKind, string> = {
  coldbrew: "#3B2414",
  water: "#CFE6F3",
  milk: "#F6EFE3",
  soda: "#E3F1F8",
  orange: "#F39A2B",
};

/* ---------- bilingual source ---------- */

type SourceIngredient = Omit<Ingredient, "name" | "short" | "amount"> & { name: T; short?: T; amount: T };
type SourceRecipe = Omit<Recipe, "name" | "summary" | "photo" | "ingredients" | "steps" | "pours" | "mixCaption" | "scene"> & {
  name: T;
  summary: T;
  photo?: Omit<Photo, "alt"> & { alt: T };
  ingredients: SourceIngredient[];
  steps: [T, T, T];
  pours: [{ ingredientId: string; caption: T }, { ingredientId: string; caption: T }];
  mixCaption: T;
};

const ml = (n: number): T => ({ th: `${n} มล.`, en: `${n} mL` });
const TO_TASTE: T = { th: "ตามชอบ", en: "to taste" };

const coldBrew: SourceIngredient = {
  id: "coldbrew",
  name: { th: "Balena Cold Brew", en: "Balena Cold Brew" },
  short: { th: "Cold Brew", en: "Cold Brew" },
  amount: ml(50),
  ml: 50,
  kind: "coldbrew",
};

const ice: SourceIngredient = { id: "ice", name: { th: "น้ำแข็ง", en: "Ice" }, amount: TO_TASTE, kind: "ice" };

const source: SourceRecipe[] = [
  {
    id: "black",
    name: { th: "กาแฟดำเย็น", en: "Iced black coffee" },
    summary: { th: "รสกาแฟชัด สดชื่น", en: "Clear coffee flavour, refreshing" },
    ingredients: [
      coldBrew,
      { id: "water", name: { th: "น้ำเย็น", en: "Cold water" }, amount: ml(100), ml: 100, kind: "water" },
      ice,
    ],
    steps: [
      { th: "ใส่น้ำแข็ง", en: "Add ice" },
      { th: "เติม Cold Brew และน้ำเย็น", en: "Add Cold Brew and cold water" },
      { th: "คนให้เข้ากัน", en: "Stir well" },
    ],
    pours: [
      { ingredientId: "coldbrew", caption: { th: "เติม Cold Brew 50 มล.", en: "Add 50 mL Cold Brew" } },
      { ingredientId: "water", caption: { th: "เติมน้ำเย็น 100 มล.", en: "Add 100 mL cold water" } },
    ],
    mixCaption: { th: "คนให้เข้ากัน", en: "Stir well" },
    mixedColor: "#5A3820",
  },
  {
    id: "latte",
    name: { th: "กาแฟนมเย็น", en: "Iced latte" },
    summary: { th: "นุ่ม กลมกล่อม", en: "Smooth and mellow" },
    ingredients: [
      coldBrew,
      { id: "milk", name: { th: "นมสดหรือนมพืช", en: "Milk or plant milk" }, short: { th: "นม", en: "Milk" }, amount: ml(100), ml: 100, kind: "milk" },
      ice,
      { id: "syrup", name: { th: "น้ำเชื่อม", en: "Syrup" }, amount: { th: "ตามชอบ ไม่จำเป็นต้องเติม", en: "to taste, optional" }, optional: true },
    ],
    steps: [
      { th: "ใส่น้ำแข็งและนม", en: "Add ice and milk" },
      { th: "เติม Cold Brew", en: "Add Cold Brew" },
      { th: "คนให้เข้ากันและปรับความหวานตามชอบ", en: "Stir and sweeten to taste" },
    ],
    pours: [
      { ingredientId: "milk", caption: { th: "เติมนม 100 มล.", en: "Add 100 mL milk" } },
      { ingredientId: "coldbrew", caption: { th: "เติม Cold Brew 50 มล.", en: "Add 50 mL Cold Brew" } },
    ],
    mixCaption: { th: "คนให้เข้ากัน ปรับหวานตามชอบ", en: "Stir, sweeten to taste" },
    mixedColor: "#B98B63",
  },
  {
    id: "soda",
    name: { th: "กาแฟโซดา", en: "Coffee soda" },
    summary: { th: "ซ่า เบา ดื่มง่าย", en: "Fizzy, light and easy to drink" },
    ingredients: [
      coldBrew,
      { id: "soda", name: { th: "โซดาเย็น", en: "Cold soda water" }, short: { th: "โซดาเย็น", en: "Soda" }, amount: ml(100), ml: 100, kind: "soda" },
      ice,
    ],
    steps: [
      { th: "ใส่น้ำแข็ง", en: "Add ice" },
      { th: "เติม Cold Brew", en: "Add Cold Brew" },
      { th: "เติมโซดาช้า\u00A0ๆ และคนเบา\u00A0ๆ", en: "Pour in the soda slowly and stir gently" },
    ],
    pours: [
      { ingredientId: "coldbrew", caption: { th: "เติม Cold Brew 50 มล.", en: "Add 50 mL Cold Brew" } },
      { ingredientId: "soda", caption: { th: "ค่อย\u00A0ๆ เติมโซดา 100 มล.", en: "Slowly add 100 mL soda" } },
    ],
    mixCaption: { th: "คนเบา\u00A0ๆ", en: "Stir gently" },
    mixedColor: "#6A4428",
    bubbles: true,
  },
  {
    id: "orange",
    name: { th: "กาแฟส้ม", en: "Orange coffee" },
    summary: { th: "เปรี้ยวหวานจากส้ม ตัดกับกาแฟ", en: "Sweet-sour orange against coffee" },
    ingredients: [
      coldBrew,
      { id: "orange", name: { th: "น้ำส้ม", en: "Orange juice" }, amount: ml(100), ml: 100, kind: "orange" },
      ice,
    ],
    steps: [
      { th: "ใส่น้ำแข็ง", en: "Add ice" },
      { th: "เติมน้ำส้ม", en: "Add orange juice" },
      { th: "ค่อย\u00A0ๆ เติม Cold Brew และคนก่อนดื่ม", en: "Slowly add Cold Brew and stir before drinking" },
    ],
    pours: [
      { ingredientId: "orange", caption: { th: "เติมน้ำส้ม 100 มล.", en: "Add 100 mL orange juice" } },
      { ingredientId: "coldbrew", caption: { th: "ค่อย\u00A0ๆ เติม Cold Brew 50 มล.", en: "Slowly add 50 mL Cold Brew" } },
    ],
    mixCaption: { th: "คนก่อนดื่ม", en: "Stir before drinking" },
    mixedColor: "#8C4E1E",
  },
];

/** The bilingual source, for the translation check (scripts/check-i18n.mjs). */
export const recipeSource = { recipes: source, scene: SCENE, starterNote: STARTER_NOTE };

const resolve = (r: SourceRecipe, lang: Lang): Recipe => ({
  ...r,
  name: r.name[lang],
  summary: r.summary[lang],
  photo: r.photo && { ...r.photo, alt: r.photo.alt[lang] },
  ingredients: r.ingredients.map((i) => ({ ...i, name: i.name[lang], short: i.short?.[lang], amount: i.amount[lang] })),
  steps: r.steps.map((s) => s[lang]) as Recipe["steps"],
  pours: r.pours.map((p) => ({ ...p, caption: p.caption[lang] })) as Recipe["pours"],
  mixCaption: r.mixCaption[lang],
  scene: SCENE[lang],
});

const byLang: Record<Lang, Recipe[]> = { th: source.map((r) => resolve(r, "th")), en: source.map((r) => resolve(r, "en")) };

/** The recipes in one language. */
export const recipesFor = (lang: Lang): Recipe[] => byLang[lang];
/** Thai recipes (the default language). */
export const recipes = byLang.th;

export function findRecipe(id: string, lang: Lang = "th"): Recipe {
  return byLang[lang].find((r) => r.id === id) ?? byLang[lang][0];
}

export function ingredientById(recipe: Recipe, id: string): Ingredient {
  const found = recipe.ingredients.find((i) => i.id === id);
  if (!found) throw new Error(`Recipe ${recipe.id} pours unknown ingredient ${id}`);
  return found;
}
