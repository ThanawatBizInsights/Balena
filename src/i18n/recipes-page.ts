// Every customer-facing string on /cold-brew-recipes/ (outside the recipes themselves, which
// are in src/config/recipes.ts), in Thai and English. `en` must have the same keys as `th`.
import { useLang } from "./lang";

const th = {
  meta: {
    title: "วิธีชง Balena Cold Brew",
    description: "สูตรเริ่มต้นสำหรับชง Balena Cold Brew Concentrate สูตร Original: กาแฟดำเย็น กาแฟนมเย็น กาแฟโซดา และกาแฟส้ม",
  },
  nav: { home: "หน้าแรก", products: "สินค้าของเรา", language: "เลือกภาษา", mainMenu: "เมนูหลัก" },
  hero: {
    title: "ชงแก้วโปรดง่าย ๆ กับ Balena",
    lead: "Cold Brew Concentrate สูตร Original ผสมได้หลายเมนู ปรับความเข้มได้ตามใจ",
    cta: "เลือกเมนูที่อยากลอง",
    photoAlt: "Balena Cold Brew Concentrate สูตร Original ขนาด 500 มล.",
    photoMissing: "รูปสินค้า Balena Cold Brew",
  },
  recipes: {
    title: "เลือกเมนู",
    lead: "แตะเมนูเพื่อดูส่วนผสม วิธีชง และภาพเคลื่อนไหว",
    ingredients: "ส่วนผสม",
    method: "วิธีชง",
  },
  animation: {
    title: "ดูวิธีชงแบบภาพเคลื่อนไหว",
    failed: "แอนิเมชันโหลดไม่สำเร็จ ดูขั้นตอนด้านบนแทนได้เลย",
    optIn: "เปิดภาพเคลื่อนไหว",
    still: "ภาพ{name}ที่ชงเสร็จแล้ว",
    controls: "ควบคุมแอนิเมชัน{name}",
    play: "เล่นวิธีชง",
    resume: "เล่นต่อ",
    pause: "หยุดชั่วคราว",
    replay: "เล่นใหม่",
    playing: "กำลังเล่น",
    paused: "หยุดชั่วคราว",
    ended: "เล่นจบแล้ว",
  },
  strength: {
    title: "ชอบเข้มหรือเบา ปรับได้",
    body: "เริ่มจากสูตรแนะนำแล้วชิม หากเข้มไปให้เติมน้ำหรือนมทีละน้อย หากอ่อนไปให้เพิ่ม Cold Brew ทีละน้อย",
    strong: "เข้มไป",
    strongText: "เติมน้ำหรือนมทีละน้อย แล้วชิมอีกครั้ง",
    weak: "อ่อนไป",
    weakText: "เพิ่ม Cold Brew ทีละน้อย แล้วชิมอีกครั้ง",
    note: "ปริมาณและสัดส่วนในสูตรคิดจากของเหลวก่อนใส่น้ำแข็ง เช่น Cold Brew 50 มล. ต่อน้ำหรือนม 100 มล. น้ำแข็งที่ละลายจะทำให้รสอ่อนลงเล็กน้อย",
  },
  storage: {
    title: "เก็บอย่างไร",
    body: "เก็บในตู้เย็น ปิดฝาให้สนิทหลังใช้ และตรวจสอบวันหมดอายุบนบรรจุภัณฑ์",
  },
  footer: {
    order: "สั่งซื้อ Balena Cold Brew",
    ask: "สอบถามวิธีชง",
  },
};

export type RecipesPageText = typeof th;

const en: RecipesPageText = {
  meta: {
    title: "How to brew Balena Cold Brew",
    description: "Starter recipes for Balena Cold Brew Concentrate Original: iced black coffee, iced latte, coffee soda and orange coffee.",
  },
  nav: { home: "Home", products: "Our Products", language: "Choose language", mainMenu: "Main menu" },
  hero: {
    title: "Your favourite drinks, made easy with Balena",
    lead: "Cold Brew Concentrate Original mixes into many drinks. Adjust the strength to taste.",
    cta: "Choose a drink to try",
    photoAlt: "Balena Cold Brew Concentrate Original, 500 mL",
    photoMissing: "Balena Cold Brew product photo",
  },
  recipes: {
    title: "Choose a drink",
    lead: "Tap a drink to see the ingredients, steps and animation.",
    ingredients: "Ingredients",
    method: "How to make it",
  },
  animation: {
    title: "Watch how to make it",
    failed: "The animation couldn't load. The steps above have everything you need.",
    optIn: "Turn on animation",
    still: "Finished {name}",
    controls: "{name} animation controls",
    play: "Play",
    resume: "Resume",
    pause: "Pause",
    replay: "Replay",
    playing: "Playing",
    paused: "Paused",
    ended: "Finished",
  },
  strength: {
    title: "Stronger or lighter? You decide",
    body: "Start with the suggested recipe and taste. Too strong: add a little water or milk. Too light: add a little more Cold Brew.",
    strong: "Too strong",
    strongText: "Add a little water or milk, then taste again.",
    weak: "Too light",
    weakText: "Add a little more Cold Brew, then taste again.",
    note: "Amounts and ratios are liquid volumes before ice, for example 50 mL Cold Brew to 100 mL water or milk. Melting ice makes the drink a little lighter.",
  },
  storage: {
    title: "How to store it",
    body: "Keep refrigerated, close tightly after use, and check the expiry date on the pack.",
  },
  footer: {
    order: "Order Balena Cold Brew",
    ask: "Ask how to brew",
  },
};

export const recipesPageText = { th, en };

/** The recipe page text in the visitor's language. */
export function usePageText(): RecipesPageText & { lang: "th" | "en" } {
  const lang = useLang();
  return { ...recipesPageText[lang], lang };
}
