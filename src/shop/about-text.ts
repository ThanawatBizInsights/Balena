// All "รู้จักเรา" (/about) page text in Thai and English. This is the story and imagery of the
// earlier home page. Edit wording here; both languages must have the same keys (TypeScript
// checks this).

export type Lang = "th" | "en";

const th = {
  meta: {
    title: "รู้จักเรา | Balena Roastery",
    description: "เรื่องราวของ Balena Roastery วาฬตัวใหญ่ที่คั่วกาแฟทีละล็อตเล็ก ทั้งเมล็ดกาแฟคั่วและโคลด์บรูว์",
  },
  language: "ภาษา",
  hero: {
    kicker: "About Balena",
    title: ["รู้จัก", "Balena Roastery"],
    lead: "เมล็ดกาแฟคั่วล็อตเล็ก และโคลด์บรูว์ จาก Balena Roastery วาฬตัวใหญ่ แต่คั่วทีละน้อย",
  },
  story: {
    title: "ทำไมต้องวาฬ",
    p1: "Balena แปลว่า “วาฬ” ในภาษาอิตาลี สัตว์ตัวใหญ่ที่ใจดีและสบาย\u00A0ๆ เหมือนกาแฟแก้วที่เราอยากให้คุณ",
    p2: "Big whale. Small batch. วาฬตัวใหญ่ แต่เราคั่วและชงทีละน้อย ใส่ใจทุกแก้ว",
    sign: "A small cup for a brighter world",
  },
  make: {
    title: "สิ่งที่เราทำ",
    lead: "เริ่มจากสองอย่างที่เราตั้งใจทำ",
    coldbrew: {
      name: "โคลด์บรูว์",
      text: "กาแฟสกัดเย็นแบบเข้มข้น เติมน้ำ นม โซดา หรือน้ำส้ม แล้วปรับความเข้มได้ตามใจ",
      points: ["ถุงขนาด 500 มล.", "ชงได้หลายเมนู", "เก็บในตู้เย็น ปิดฝาให้สนิทหลังใช้"],
      cta: "ดูโคลด์บรูว์",
    },
    beans: {
      name: "เมล็ดกาแฟคั่ว",
      text: "คั่วทีละล็อตเล็ก\u00A0ๆ เพื่อดูแลรสชาติในทุกถุง",
      cta: "ดูเมล็ดกาแฟ",
    },
  },
  drinks: {
    title: "เมนูซิกเนเจอร์",
    lead: "เมนูโปรดของวาฬ ลองชิมแล้วเลือกแก้วที่ใช่",
    items: ["เอสเปรสโซโซดามะนาว", "เอสเปรสโซน้ำส้ม", "อเมริกาโนเย็น", "ช็อกโกแลตเย็น สูตรไม่มีน้ำตาล"],
    alt: "เมนูซิกเนเจอร์ของ Balena Roastery",
    home: "อยากชงเองที่บ้าน",
    homeLink: "ดูวิธีชงด้วย Cold Brew",
  },
  alt: {
    welcome: "วาฬ Balena กับ Cold Brew Concentrate Original 500 มล. และกาแฟเย็นหนึ่งแก้ว",
    banner: "ถุง Balena Cold Brew Concentrate Original 500 มล. ริมทะเล กับวาฬ Balena",
    sticker: "วาฬ Balena มีถ้วยกาแฟบนหัว",
  },
};

const en: typeof th = {
  meta: {
    title: "About us | Balena Roastery",
    description: "The story of Balena Roastery: a big whale roasting coffee in small batches, from roasted beans to cold brew.",
  },
  language: "Language",
  hero: {
    kicker: "About Balena",
    title: ["About", "Balena Roastery"],
    lead: "Small-batch roasted coffee beans and cold brew from Balena Roastery. Big whale. Small batch.",
  },
  story: {
    title: "Why a whale?",
    p1: "Balena means “whale” in Italian: big, gentle and easy-going, like the cup of coffee we want to hand you.",
    p2: "Big whale. Small batch. We roast and brew a little at a time, with care in every cup.",
    sign: "A small cup for a brighter world",
  },
  make: {
    title: "What we make",
    lead: "Two things we make with care.",
    coldbrew: {
      name: "Cold brew",
      text: "Concentrated cold brew coffee. Add water, milk, soda or orange juice, then adjust the strength to taste.",
      points: ["500 mL pouch", "Makes many different drinks", "Keep refrigerated and close tightly after use"],
      cta: "See cold brew",
    },
    beans: {
      name: "Roasted coffee beans",
      text: "Roasted in small batches, so we can look after the flavour of every bag.",
      cta: "See coffee beans",
    },
  },
  drinks: {
    title: "Signature drinks",
    lead: "The whale's favourites. Find your cup.",
    items: ["Sparkling Lime Espresso", "Espresso with Orange Juice", "Ice Americano", "Cold Chocolate Zero Sugar"],
    alt: "Balena Roastery signature drinks",
    home: "Making it at home?",
    homeLink: "Brew with Cold Brew",
  },
  alt: {
    welcome: "The Balena whale with Cold Brew Concentrate Original 500 mL and a glass of iced coffee",
    banner: "Balena Cold Brew Concentrate Original 500 mL pouch by the sea, with the Balena whale",
    sticker: "The Balena whale with a coffee cup on its head",
  },
};

export const text = { th, en };
export type Text = typeof th;
