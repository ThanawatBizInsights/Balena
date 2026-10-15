import type { Inputs } from "./calc";

// Starting values for the calculator. Numbers marked source: "yours" came from the owner
// (375 g Basil Santos 100%, 3 L water, 2.6 L yield, 7-baht pouch, 2-baht sticker).
// Everything marked "estimate" is a placeholder to replace with real receipts.
// Values typed on the page are saved in that browser only; edit this file to change
// what everyone starts with.

export const COFFEE_NAME = "Basil Santos Coffee 100%";

/** Which starting values are the owner's own numbers (shown with a "ตัวเลขจริง" badge). */
export const YOURS = new Set(["coffeeGrams", "waterLiters", "yieldLiters", "pouchMl"]);

export const defaults: Inputs = {
  coffeeGrams: 375,
  coffeePricePerKg: 600, // estimate: replace with the real price per kg
  waterLiters: 3,
  yieldLiters: 2.6,
  pouchMl: 500,
  price: 150, // estimate: replace with the planned selling price
  batchesPerMonth: 8,
  pouchesPerOrder: 2,
  lossRate: 0.05,
  feeRate: 0,
  mlPerCup: 50,
  items: [
    // ต่อรอบการชง
    { id: "water", name: "น้ำดื่มสำหรับชง", why: "น้ำที่ใช้ชงก็มีราคา ถ้าใช้น้ำกรองหรือน้ำขวด", unit: "batch", qty: 3, qtyLabel: "ลิตร", price: 1, enabled: true, source: "estimate" },
    { id: "filter", name: "ถุงกรองหรือกระดาษกรอง", why: "ของใช้แล้วทิ้ง หรือผ้ากรองที่ต้องเปลี่ยนเป็นระยะ", unit: "batch", qty: 1, price: 10, enabled: true, source: "estimate" },
    { id: "cleaning", name: "น้ำยาล้างและฆ่าเชื้อ", why: "ล้างโถ ถุง และอุปกรณ์ให้สะอาดทุกรอบ", unit: "batch", qty: 1, price: 5, enabled: true, source: "estimate" },
    { id: "labor", name: "ค่าแรงของคุณ", why: "เวลาชง กรอง บรรจุ ติดฉลาก และล้าง มักไม่ถูกนับ", unit: "batch", qty: 1.5, qtyLabel: "ชั่วโมง", price: 50, enabled: true, source: "estimate" },
    // ต่อถุง
    { id: "pouch", name: "ถุงเพาช์ 500 มล.", why: "", unit: "pouch", qty: 1, price: 7, enabled: true, source: "yours" },
    { id: "sticker", name: "สติกเกอร์ฉลาก", why: "", unit: "pouch", qty: 1, price: 2, enabled: true, source: "yours" },
    { id: "datelabel", name: "ฉลากวันผลิตและวันหมดอายุ", why: "สติกเกอร์เล็กหรือหมึกพิมพ์วันที่ ทุกถุงต้องมี", unit: "pouch", qty: 1, price: 0.5, enabled: true, source: "estimate" },
    // ต่อออเดอร์
    { id: "icepack", name: "เจลเย็นหรือไอซ์แพ็ก", why: "Cold Brew ต้องเย็นตลอดทางส่ง", unit: "order", qty: 1, price: 5, enabled: true, source: "estimate" },
    { id: "coolbag", name: "ถุงเก็บความเย็นหรือกล่องโฟม", why: "บรรจุภัณฑ์ส่งที่มักลืมคิด", unit: "order", qty: 1, price: 15, enabled: true, source: "estimate" },
    { id: "shipping", name: "ค่าส่ง (ถ้าส่งฟรี)", why: "ถ้าคุณจ่ายค่าส่งแทนลูกค้า ต้องรวมไว้ในต้นทุน", unit: "order", qty: 1, price: 40, enabled: false, source: "estimate" },
    // ต่อเดือน
    { id: "electricity", name: "ค่าไฟตู้เย็น", why: "แช่สกัดและเก็บสินค้าในตู้เย็นตลอดเวลา", unit: "month", qty: 1, price: 100, enabled: true, source: "estimate" },
    { id: "equipment", name: "ค่าเสื่อมอุปกรณ์", why: "โถ ตาชั่ง เครื่องบด ที่ซีล ฯลฯ เช่น 3,000 บาท ใช้ 12 เดือน", unit: "month", qty: 1, price: 250, enabled: true, source: "estimate" },
    { id: "marketing", name: "แจกชิมและโฆษณา", why: "ของแจก ตัวอย่าง หรือค่าโฆษณาในแต่ละเดือน", unit: "month", qty: 1, price: 300, enabled: true, source: "estimate" },
    { id: "lineoa", name: "แพ็กเกจ LINE OA", why: "แพ็กเกจฟรีส่งข้อความได้จำกัด ถ้าเกินต้องจ่ายรายเดือน", unit: "month", qty: 1, price: 0, enabled: true, source: "estimate" },
  ],
};
