import { site } from "../config/site";

/** Development preview only: lists settings that still need real values. */
export function ConfigNotice() {
  const missing = [
    !site.productImage.src && "รูปสินค้า (site.productImage.src)",
    !site.links.order && "ลิงก์สั่งซื้อ (site.links.order)",
    !site.links.ask && "ลิงก์สอบถามวิธีชง (site.links.ask)",
  ].filter(Boolean);
  if (missing.length === 0) return null;
  return (
    <div className="config-notice" role="note">
      ตัวอย่างสำหรับทีมงาน: ยังต้องใส่ {missing.join(", ")} ใน src/config/site.ts
    </div>
  );
}
