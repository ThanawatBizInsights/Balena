// Every customer-facing string on the shop pages (/, /products, /about, 404, header, footer,
// contact, purchase buttons), in Thai and English.
//
// Edit wording here, never inside components. `en` must have exactly the same keys as `th`
// (TypeScript checks the shape; `npm run check:i18n` also reports empty or missing values).
// Product facts live in src/data/products.ts.

const th = {
  meta: {
    home: {
      title: "Balena Roastery | ชงง่ายที่บ้าน เข้มอร่อยได้ทุกเมนู",
      description: "โคลด์บรูว์และเมล็ดกาแฟคั่วจาก Balena Roastery ชงง่ายที่บ้าน เข้มอร่อยได้ทุกเมนู สั่งซื้อผ่าน Shopee, Lazada, LINE OA หรือ Facebook",
    },
    products: {
      title: "สินค้าของเรา | Balena Roastery",
      description: "โคลด์บรูว์และเมล็ดกาแฟคั่วทุกรายการของ Balena Roastery รสชาติตามฉลาก ขนาด ระดับการคั่ว และช่องทางสั่งซื้อ",
    },
    about: {
      title: "รู้จักเรา | Balena Roastery",
      description: "เรื่องราวของ Balena Roastery วาฬตัวใหญ่ที่คั่วกาแฟทีละล็อตเล็ก ทั้งเมล็ดกาแฟคั่วและโคลด์บรูว์",
    },
    shop: {
      title: "เลือกช่องทางสั่งซื้อ | Balena Roastery",
      description: "สั่งโคลด์บรูว์และเมล็ดกาแฟคั่ว Balena ผ่าน Shopee, LINE SHOP, LINE OA หรือ Grab Delivery สาขาบางใหญ่",
    },
    notFound: {
      title: "ไม่พบหน้านี้ | Balena Roastery",
      description: "ไม่พบหน้าที่คุณกำลังหา กลับไปหน้าแรกหรือดูสินค้าของเรา",
    },
  },
  common: {
    skip: "ข้ามไปเนื้อหา",
    home: "Balena Roastery หน้าแรก",
    menu: "เมนู",
    close: "ปิด",
    mainMenu: "เมนูหลัก",
    language: "เลือกภาษา",
    imageMissing: "ไม่พบรูป",
    newTab: "เปิดในแท็บใหม่",
  },
  nav: {
    home: "หน้าแรก",
    products: "สินค้าของเรา",
    shop: "ช่องทางสั่งซื้อ",
    about: "รู้จักเรา",
    contact: "ติดต่อเรา",
  },
  categories: {
    "cold-brew": "โคลด์บรูว์",
    beans: "เมล็ดกาแฟคั่ว",
  },
  buy: {
    heading: "ช่องทางสั่งซื้อ",
    headingProduct: "สั่งซื้อสินค้านี้",
    headingContact: "ช่องทางสั่งซื้อและติดต่อ",
    none: "ช่องทางสั่งซื้อจะอัปเดตเร็ว ๆ นี้",
    channels: {
      shopee: { action: "ซื้อผ่าน Shopee", hint: "ร้านค้าบน Shopee" },
      lineShop: { action: "ซื้อผ่าน LINE SHOP", hint: "ร้านค้าบน LINE SHOP" },
      grab: { action: "เปิดร้านบน Grab", hint: "Grab Delivery สาขาบางใหญ่" },
      lazada: { action: "ซื้อผ่าน Lazada", hint: "ร้านค้าบน Lazada" },
      lineOA: { action: "สั่งซื้อผ่าน LINE OA", hint: "ทักแชทเพื่อสั่งซื้อหรือสอบถาม" },
      facebook: { action: "สั่งซื้อผ่าน Facebook", hint: "ทักแชทเพื่อสั่งซื้อหรือสอบถาม" },
    },
  },
  contact: {
    title: "ติดต่อเรา",
    lead: "สั่งซื้อหรือสอบถามผ่านช่องทางที่สะดวก",
    all: "ดูทุกช่องทางสั่งซื้อ",
  },
  footer: {
    products: "สินค้า",
    recipes: "วิธีชง Cold Brew",
    rights: "สงวนลิขสิทธิ์",
  },
  home: {
    seeColdBrew: "ดูโคลด์บรูว์",
    seeBeans: "ดูเมล็ดกาแฟ",
    details: "ดูรายละเอียดสินค้า",
    coldBrewLead: "ถุง 500 มล. พร้อมจุกเท ชงง่ายที่บ้าน",
    recipes: "ดูวิธีชง Cold Brew",
    beansLead: "{count} รายการ คั่วแบบทั้งเมล็ด (Whole Bean) ขนาด 200 กรัม และ 100 กรัม",
    whyWhale: "ทำไมต้องวาฬ",
    whyWhaleText: "Balena แปลว่า “วาฬ” ในภาษาอิตาลี สัตว์ตัวใหญ่ที่ใจดีและสบาย ๆ เหมือนกาแฟแก้วที่เราอยากให้คุณ",
    aboutCta: "รู้จักเรา",
    whaleAlt: "วาฬ Balena มีถ้วยกาแฟบนหัว",
  },
  catalog: {
    title: "สินค้าของเรา",
    categoriesLabel: "หมวดสินค้า",
    count: "{count} รายการ · เลือกเพื่อดูรายละเอียด",
    choose: "เลือก{category}",
    previous: "{category}ก่อนหน้า",
    next: "{category}ถัดไป",
    photos: "รูปสินค้า",
    photo: "รูปที่ {n}: {alt}",
    use: "แนะนำการใช้",
    facts: {
      type: "ประเภท",
      flavour: "รส",
      notes: "รสชาติตามฉลาก",
      size: "ขนาด",
      roast: "ระดับการคั่ว",
      process: "กระบวนการ",
      altitude: "ความสูงที่ปลูก",
      form: "รูปแบบ",
    },
  },
  about: {
    kicker: "About Balena",
    title: ["รู้จัก", "Balena Roastery"],
    lead: "เมล็ดกาแฟคั่วล็อตเล็ก และโคลด์บรูว์ จาก Balena Roastery วาฬตัวใหญ่ แต่คั่วทีละน้อย",
    story: {
      title: "ทำไมต้องวาฬ",
      p1: "Balena แปลว่า “วาฬ” ในภาษาอิตาลี สัตว์ตัวใหญ่ที่ใจดีและสบาย ๆ เหมือนกาแฟแก้วที่เราอยากให้คุณ",
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
        text: "คั่วทีละล็อตเล็ก ๆ เพื่อดูแลรสชาติในทุกถุง",
        cta: "ดูเมล็ดกาแฟ",
      },
    },
    drinks: {
      title: "เมนูซิกเนเจอร์",
      lead: "เมนูโปรดของวาฬ ลองชิมแล้วเลือกแก้วที่ใช่",
      items: ["เอสเปรสโซโซดามะนาว", "เอสเปรสโซน้ำส้ม", "อเมริกาโนเย็น", "ช็อกโกแลตเย็น สูตรไม่มีน้ำตาล"],
      home: "อยากชงเองที่บ้าน",
      homeLink: "ดูวิธีชงด้วย Cold Brew",
    },
    alt: {
      welcome: "วาฬ Balena กับ Cold Brew Concentrate Original 500 มล. และกาแฟเย็นหนึ่งแก้ว",
      banner: "ถุง Balena Cold Brew Concentrate Original 500 มล. ริมทะเล กับวาฬ Balena",
      sticker: "วาฬ Balena มีถ้วยกาแฟบนหัว",
      drinks: "เมนูซิกเนเจอร์ของ Balena Roastery",
    },
  },
  hub: {
    title: "เลือกช่องทางสั่งซื้อ",
    lead: "กาแฟแก้วโปรด สั่งได้ในช่องทางที่คุณสะดวก",
    text: "เลือกซื้อโคลด์บรูว์และเมล็ดกาแฟ หรือทักมาคุยกับเราได้เลย",
    mascotAlt: "วาฬ Balena มีถ้วยกาแฟบนหัว",
    cards: {
      shopee: { title: "Shopee", description: "เลือกสินค้าและสั่งซื้อผ่าน Shopee", button: "ไปที่ร้าน Shopee" },
      lineShop: { title: "LINE SHOP", description: "เลือกสินค้าและสั่งซื้อผ่าน LINE SHOP", button: "ไปที่ LINE SHOP" },
      lineOA: { title: "LINE Official Account", description: "สอบถามสินค้า ขอคำแนะนำ หรือทักมาสั่งซื้อ", button: "แชทกับเราทาง LINE" },
      website: { title: "เว็บไซต์ Balena", description: "รู้จัก Balena และดูรายละเอียดสินค้าของเรา", button: "เยี่ยมชมเว็บไซต์" },
      grab: { title: "Grab Delivery — สาขาบางใหญ่", description: "ตรวจสอบพื้นที่จัดส่ง เมนู และเวลาเปิดให้บริการในแอป Grab", button: "เปิดร้านบน Grab" },
      lazada: { title: "Lazada", description: "เลือกสินค้าและสั่งซื้อผ่าน Lazada", button: "ไปที่ร้าน Lazada" },
      facebook: { title: "Facebook", description: "ทักแชทมาสอบถามหรือสั่งซื้อทาง Facebook", button: "แชทกับเราทาง Facebook" },
    },
    groups: { online: "สั่งซื้อและติดต่อ", delivery: "เดลิเวอรี" },
    opensIn: { line: "เปิดในแอป LINE", grab: "เปิดในแอป Grab" },
    copy: {
      button: "คัดลอกลิงก์หน้านี้",
      done: "คัดลอกลิงก์แล้ว",
      failed: "คัดลอกอัตโนมัติไม่ได้ กดค้างที่ลิงก์ด้านล่างเพื่อคัดลอก",
    },
  },
  notFound: {
    title: "ไม่พบหน้านี้",
    text: "หน้าที่คุณกำลังหาอาจถูกย้ายหรือไม่มีอยู่แล้ว",
    home: "กลับหน้าแรก",
    products: "ดูสินค้าของเรา",
  },
};

export type ShopText = typeof th;

const en: ShopText = {
  meta: {
    home: {
      title: "Balena Roastery | Your everyday coffee, made at home",
      description: "Cold brew and roasted coffee beans from Balena Roastery. Your everyday coffee, made at home. Order on Shopee, Lazada, LINE OA or Facebook.",
    },
    products: {
      title: "Our Products | Balena Roastery",
      description: "Every Balena Roastery cold brew and roasted coffee bean: label taste notes, sizes, roast levels and where to order.",
    },
    about: {
      title: "About Us | Balena Roastery",
      description: "The story of Balena Roastery: a big whale roasting coffee in small batches, from roasted beans to cold brew.",
    },
    shop: {
      title: "Shop Balena | Balena Roastery",
      description: "Order Balena cold brew and roasted coffee beans on Shopee, LINE SHOP, LINE OA or Grab Delivery (Bang Yai).",
    },
    notFound: {
      title: "Page not found | Balena Roastery",
      description: "We couldn't find that page. Go back home or see our products.",
    },
  },
  common: {
    skip: "Skip to content",
    home: "Balena Roastery home",
    menu: "Menu",
    close: "Close",
    mainMenu: "Main menu",
    language: "Choose language",
    imageMissing: "Image not found",
    newTab: "opens in a new tab",
  },
  nav: {
    home: "Home",
    products: "Our Products",
    shop: "Where to Buy",
    about: "About Us",
    contact: "Contact",
  },
  categories: {
    "cold-brew": "Cold Brew",
    beans: "Roasted Coffee Beans",
  },
  buy: {
    heading: "Where to order",
    headingProduct: "Order this product",
    headingContact: "Order and contact",
    none: "Ordering channels coming soon",
    channels: {
      shopee: { action: "Buy on Shopee", hint: "Our Shopee shop" },
      lineShop: { action: "Buy on LINE SHOP", hint: "Our LINE SHOP" },
      grab: { action: "Open in Grab", hint: "Grab Delivery, Bang Yai" },
      lazada: { action: "Buy on Lazada", hint: "Our Lazada shop" },
      lineOA: { action: "Order via LINE OA", hint: "Chat with us to order or ask" },
      facebook: { action: "Order via Facebook", hint: "Chat with us to order or ask" },
    },
  },
  contact: {
    title: "Contact",
    lead: "Order or ask us through whichever channel suits you.",
    all: "See all ways to buy",
  },
  footer: {
    products: "Products",
    recipes: "How to brew Cold Brew",
    rights: "All rights reserved",
  },
  home: {
    seeColdBrew: "See cold brew",
    seeBeans: "See coffee beans",
    details: "View product details",
    coldBrewLead: "500 mL pouches with a spout. Easy to make at home.",
    recipes: "How to brew Cold Brew",
    beansLead: "{count} coffees, roasted whole bean, in 200 g and 100 g bags",
    whyWhale: "Why a whale?",
    whyWhaleText: "Balena means “whale” in Italian: big, gentle and easy-going, like the cup of coffee we want to hand you.",
    aboutCta: "About us",
    whaleAlt: "The Balena whale with a coffee cup on its head",
  },
  catalog: {
    title: "Our Products",
    categoriesLabel: "Product categories",
    count: "{count} products · choose one to see details",
    choose: "Choose {category}",
    previous: "Previous: {category}",
    next: "Next: {category}",
    photos: "Product photos",
    photo: "Photo {n}: {alt}",
    use: "How to use",
    facts: {
      type: "Type",
      flavour: "Flavour",
      notes: "Taste notes (label)",
      size: "Size",
      roast: "Roast level",
      process: "Process",
      altitude: "Altitude",
      form: "Form",
    },
  },
  about: {
    kicker: "About Balena",
    title: ["About", "Balena Roastery"],
    lead: "Small-batch roasted coffee beans and cold brew from Balena Roastery. Big whale. Small batch.",
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
      home: "Making it at home?",
      homeLink: "Brew with Cold Brew",
    },
    alt: {
      welcome: "The Balena whale with Cold Brew Concentrate Original 500 mL and a glass of iced coffee",
      banner: "Balena Cold Brew Concentrate Original 500 mL pouch by the sea, with the Balena whale",
      sticker: "The Balena whale with a coffee cup on its head",
      drinks: "Balena Roastery signature drinks",
    },
  },
  hub: {
    title: "Shop Balena",
    lead: "Your favourite coffee, ordered your way.",
    text: "Shop cold brew and roasted coffee beans, or chat with us.",
    mascotAlt: "The Balena whale with a coffee cup on its head",
    cards: {
      shopee: { title: "Shopee", description: "Browse and order on Shopee.", button: "Shop on Shopee" },
      lineShop: { title: "LINE SHOP", description: "Browse and order through LINE SHOP.", button: "Shop on LINE" },
      lineOA: { title: "LINE Official Account", description: "Ask about products, get recommendations or message us to order.", button: "Chat on LINE" },
      website: { title: "Balena Website", description: "Discover Balena and explore our products.", button: "Visit Our Website" },
      grab: { title: "Grab Delivery — Bang Yai", description: "Check delivery coverage, the menu and opening hours in the Grab app.", button: "Open in Grab" },
      lazada: { title: "Lazada", description: "Browse and order on Lazada.", button: "Shop on Lazada" },
      facebook: { title: "Facebook", description: "Message us on Facebook to ask or order.", button: "Chat on Facebook" },
    },
    groups: { online: "Shop & chat", delivery: "Delivery" },
    opensIn: { line: "Opens in the LINE app", grab: "Opens in the Grab app" },
    copy: {
      button: "Copy Page Link",
      done: "Link copied",
      failed: "Couldn't copy automatically. Press and hold the link below to copy it.",
    },
  },
  notFound: {
    title: "Page not found",
    text: "The page you're looking for may have moved or no longer exists.",
    home: "Back to home",
    products: "See our products",
  },
};

export const shopText = { th, en };

/** Fills {name} placeholders. */
export const fill = (s: string, values: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));

/**
 * The approved hero pair. Both are always shown together (an intentional exception to "one
 * language at a time"); the visitor's language decides which one is the headline.
 */
export const HERO_HOOKS = {
  th: ["ชงง่ายที่บ้าน", "เข้มอร่อยได้ทุกเมนู"],
  en: ["Your everyday coffee, made at home"],
} as const;
