// All home page text in Thai and English. Edit wording here; both languages must
// have the same keys (TypeScript checks this).

export type Lang = "th" | "en";

const th = {
  meta: {
    title: "Balena Roastery | กาแฟดี วันสดใส",
    description: "Balena Roastery เมล็ดกาแฟคั่วและ Cold Brew Concentrate สูตร Original",
  },
  nav: {
    products: "สินค้า",
    drinks: "เมนูแนะนำ",
    story: "เรื่องของวาฬ",
    recipes: "วิธีชง Cold Brew",
    buy: "ซื้อได้ที่",
    menu: "เมนู",
    close: "ปิด",
    language: "ภาษา",
  },
  hero: {
    title: ["กาแฟดี\u00A0ๆ", "ให้วันสดใส"],
    lead: "เมล็ดกาแฟคั่วล็อตเล็ก และ Cold Brew Concentrate จาก Balena Roastery วาฬตัวใหญ่ แต่คั่วทีละน้อย",
    cta: "ดูสินค้าของเรา",
    secondary: "วิธีชง Cold Brew",
  },
  card: {
    tag: "Cold Brew Concentrate",
    name: "Original 500 มล.",
    text: "รสเข้ม ดื่มง่าย ผสมน้ำ นม โซดา หรือน้ำส้มได้ตามชอบ",
    order: "สั่งซื้อ",
    details: "ดูรายละเอียด",
    soon: "เปิดสั่งเร็ว ๆ นี้",
  },
  products: {
    title: "สินค้าของเรา",
    lead: "เริ่มจากสองอย่างที่เราตั้งใจทำ",
    coldbrew: {
      name: "Cold Brew Concentrate Original",
      size: "500 มล.",
      text: "กาแฟสกัดเย็นแบบเข้มข้น เติมน้ำ นม โซดา หรือน้ำส้ม แล้วปรับความเข้มได้ตามใจ",
      points: ["ขนาด 500 มล.", "ชงได้หลายเมนู", "เก็บในตู้เย็น ปิดฝาให้สนิทหลังใช้"],
      recipes: "ดูวิธีชง",
    },
    beans: {
      name: "เมล็ดกาแฟคั่ว",
      text: "คั่วทีละล็อตเล็ก ๆ เพื่อดูแลรสชาติในทุกถุง",
      soon: "รายละเอียดแหล่งปลูก ระดับการคั่ว และขนาดถุง จะแจ้งเร็ว ๆ นี้",
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
  story: {
    title: "ทำไมต้องวาฬ",
    p1: "Balena แปลว่า “วาฬ” ในภาษาอิตาลี สัตว์ตัวใหญ่ที่ใจดีและสบาย ๆ เหมือนกาแฟแก้วที่เราอยากให้คุณ",
    p2: "Big whale. Small batch. วาฬตัวใหญ่ แต่เราคั่วและชงทีละน้อย ใส่ใจทุกแก้ว",
    sign: "A small cup for a brighter world",
  },
  buy: {
    title: "ซื้อได้ที่",
    lead: "เลือกช่องทางที่สะดวก",
    soon: "เร็ว ๆ นี้",
    open: "เปิด",
  },
  footer: {
    tagline: "Good Coffee. Brighter Days.",
    recipes: "วิธีชง Cold Brew",
    rights: "สงวนลิขสิทธิ์",
  },
  alt: {
    welcome: "วาฬ Balena กับ Cold Brew Concentrate Original 500 มล. และกาแฟเย็นหนึ่งแก้ว",
    banner: "ถุง Balena Cold Brew Concentrate Original 500 มล. ริมทะเล กับวาฬ Balena",
    sticker: "วาฬ Balena มีถ้วยกาแฟบนหัว",
  },
};

const en: typeof th = {
  meta: {
    title: "Balena Roastery | Good Coffee. Brighter Days.",
    description: "Balena Roastery roasted coffee beans and Cold Brew Concentrate Original.",
  },
  nav: {
    products: "Products",
    drinks: "Signature drinks",
    story: "Our whale",
    recipes: "How to brew",
    buy: "Where to buy",
    menu: "Menu",
    close: "Close",
    language: "Language",
  },
  hero: {
    title: ["Good coffee.", "Brighter days."],
    lead: "Small-batch roasted coffee beans and Cold Brew Concentrate from Balena Roastery. Big whale. Small batch.",
    cta: "See our products",
    secondary: "How to brew Cold Brew",
  },
  card: {
    tag: "Cold Brew Concentrate",
    name: "Original 500 mL",
    text: "Bold flavour, smoother days. Mix with water, milk, soda or orange juice.",
    order: "Order",
    details: "Details",
    soon: "Ordering opens soon",
  },
  products: {
    title: "Our coffee",
    lead: "Two things we make with care.",
    coldbrew: {
      name: "Cold Brew Concentrate Original",
      size: "500 mL",
      text: "Concentrated cold brew coffee. Add water, milk, soda or orange juice, then adjust the strength to taste.",
      points: ["500 mL pouch", "Makes many different drinks", "Keep refrigerated and close tightly after use"],
      recipes: "How to brew",
    },
    beans: {
      name: "Roasted coffee beans",
      text: "Roasted in small batches, so we can look after the flavour of every bag.",
      soon: "Origins, roast levels and bag sizes coming soon.",
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
  story: {
    title: "Why a whale?",
    p1: "Balena means “whale” in Italian: big, gentle and easy-going, like the cup of coffee we want to hand you.",
    p2: "Big whale. Small batch. We roast and brew a little at a time, with care in every cup.",
    sign: "A small cup for a brighter world",
  },
  buy: {
    title: "Where to buy",
    lead: "Choose the channel that suits you.",
    soon: "Coming soon",
    open: "Open",
  },
  footer: {
    tagline: "Good Coffee. Brighter Days.",
    recipes: "How to brew Cold Brew",
    rights: "All rights reserved",
  },
  alt: {
    welcome: "The Balena whale with Cold Brew Concentrate Original 500 mL and a glass of iced coffee",
    banner: "Balena Cold Brew Concentrate Original 500 mL pouch by the sea, with the Balena whale",
    sticker: "The Balena whale with a coffee cup on its head",
  },
};

export const text = { th, en };
export type Text = typeof th;
