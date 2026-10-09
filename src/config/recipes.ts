// Recipe quantities and copy. Edit this file after taste-testing; the page text,
// the recipe cards' ratio bars and the animations all read from it.
//
// These are suggested starter recipes, not verified official formulas.

export type LiquidKind = "coldbrew" | "water" | "milk" | "soda" | "orange";

export type Ingredient = {
  id: string;
  name: string;
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

export type Recipe = {
  id: string;
  name: string;
  summary: string;
  ingredients: Ingredient[];
  steps: [string, string, string];
  /** The two liquids in the order they go into the glass (after the ice). */
  pours: [Pour, Pour];
  mixCaption: string;
  /** Colour of the finished drink after mixing. */
  mixedColor: string;
  bubbles?: boolean;
};

export const STARTER_NOTE =
  "สูตรเริ่มต้นสำหรับทดลองชง สามารถปรับสัดส่วนตามรสชาติที่ชอบ";

export const liquidColors: Record<LiquidKind, string> = {
  coldbrew: "#3B2414",
  water: "#CFE6F3",
  milk: "#F6EFE3",
  soda: "#E3F1F8",
  orange: "#F39A2B",
};

const coldBrew: Ingredient = {
  id: "coldbrew",
  name: "Balena Cold Brew",
  amount: "50 มล.",
  ml: 50,
  kind: "coldbrew",
};

const ice: Ingredient = { id: "ice", name: "น้ำแข็ง", amount: "ตามชอบ", kind: "ice" };

export const recipes: Recipe[] = [
  {
    id: "black",
    name: "กาแฟดำเย็น",
    summary: "รสกาแฟชัด สดชื่น",
    ingredients: [
      coldBrew,
      { id: "water", name: "น้ำเย็น", amount: "100 มล.", ml: 100, kind: "water" },
      ice,
    ],
    steps: ["ใส่น้ำแข็ง", "เติม Cold Brew และน้ำเย็น", "คนให้เข้ากัน"],
    pours: [
      { ingredientId: "coldbrew", caption: "เติม Cold Brew 50 มล." },
      { ingredientId: "water", caption: "เติมน้ำเย็น 100 มล." },
    ],
    mixCaption: "คนให้เข้ากัน",
    mixedColor: "#5A3820",
  },
  {
    id: "latte",
    name: "กาแฟนมเย็น",
    summary: "นุ่ม กลมกล่อม",
    ingredients: [
      coldBrew,
      { id: "milk", name: "นมสดหรือนมพืช", amount: "100 มล.", ml: 100, kind: "milk" },
      ice,
      { id: "syrup", name: "น้ำเชื่อม", amount: "ตามชอบ ไม่จำเป็นต้องเติม", optional: true },
    ],
    steps: [
      "ใส่น้ำแข็งและนม",
      "เติม Cold Brew",
      "คนให้เข้ากันและปรับความหวานตามชอบ",
    ],
    pours: [
      { ingredientId: "milk", caption: "เติมนม 100 มล." },
      { ingredientId: "coldbrew", caption: "เติม Cold Brew 50 มล." },
    ],
    mixCaption: "คนให้เข้ากัน ปรับหวานตามชอบ",
    mixedColor: "#B98B63",
  },
  {
    id: "soda",
    name: "กาแฟโซดา",
    summary: "ซ่า เบา ดื่มง่าย",
    ingredients: [
      coldBrew,
      { id: "soda", name: "โซดาเย็น", amount: "100 มล.", ml: 100, kind: "soda" },
      ice,
    ],
    steps: ["ใส่น้ำแข็ง", "เติม Cold Brew", "เติมโซดาช้า ๆ และคนเบา ๆ"],
    pours: [
      { ingredientId: "coldbrew", caption: "เติม Cold Brew 50 มล." },
      { ingredientId: "soda", caption: "ค่อย ๆ เติมโซดา 100 มล." },
    ],
    mixCaption: "คนเบา ๆ",
    mixedColor: "#6A4428",
    bubbles: true,
  },
  {
    id: "orange",
    name: "กาแฟส้ม",
    summary: "เปรี้ยวหวานจากส้ม ตัดกับกาแฟ",
    ingredients: [
      coldBrew,
      { id: "orange", name: "น้ำส้ม", amount: "100 มล.", ml: 100, kind: "orange" },
      ice,
    ],
    steps: ["ใส่น้ำแข็ง", "เติมน้ำส้ม", "ค่อย ๆ เติม Cold Brew และคนก่อนดื่ม"],
    pours: [
      { ingredientId: "orange", caption: "เติมน้ำส้ม 100 มล." },
      { ingredientId: "coldbrew", caption: "ค่อย ๆ เติม Cold Brew 50 มล." },
    ],
    mixCaption: "คนก่อนดื่ม",
    mixedColor: "#8C4E1E",
  },
];

export function findRecipe(id: string): Recipe {
  return recipes.find((r) => r.id === id) ?? recipes[0];
}

export function ingredientById(recipe: Recipe, id: string): Ingredient {
  const found = recipe.ingredients.find((i) => i.id === id);
  if (!found) throw new Error(`Recipe ${recipe.id} pours unknown ingredient ${id}`);
  return found;
}
