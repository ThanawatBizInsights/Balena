import { useState, type FormEvent } from "react";
import { Link, navigate, useTitle } from "../router";
import { clearCart, priceLines, useCart } from "../state/cart";
import { demoRef, setDemoOrder } from "../state/demoOrder";
import { baht, useTestPrices } from "../state/pricing";
import { Shell } from "../components/ui";

export const DEMO_NOTICE = "ทดลองสั่งซื้อ — ยังไม่มีการเรียกเก็บเงินหรือส่งคำสั่งซื้อจริง";

export function Checkout() {
  useTitle("ทดลองสั่งซื้อ");
  const cart = useCart();
  const testPrices = useTestPrices();
  const { lines, subtotal, hasTest } = priceLines(cart, testPrices);
  const payable = lines.filter((l) => l.ok);
  // Details stay in this component's memory only: never saved, never sent.
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("ใส่ชื่อผู้รับก่อน (ใช้ทดลองเท่านั้น ไม่ถูกบันทึก)"); return; }
    setDemoOrder({
      ref: demoRef(),
      lines: payable.map((l) => ({ name: l.product!.name, subtitle: l.product!.subtitle, variant: l.variant!.label, qty: l.qty, unit: l.unit!, lineTotal: l.lineTotal, isTest: l.isTest, image: l.product })),
      subtotal, count: payable.reduce((n, l) => n + l.qty, 0), hasTest,
    });
    clearCart();
    navigate("/trial/complete", { replace: true });
  };

  if (payable.length === 0) {
    return (
      <Shell tone="light">
        <section className="empty">
          <h1 className="h-th">ยังไม่มีสินค้าที่สั่งได้</h1>
          <p>เพิ่มสินค้าที่มีราคาลงตะกร้าก่อน แล้วค่อยทดลองสั่งซื้อ</p>
          <Link to="/trial/order" className="btn btn--navy">เลือกสินค้า</Link>
        </section>
      </Shell>
    );
  }

  return (
    <Shell tone="light">
      <section className="checkout">
        <p className="demo-banner" role="note">{DEMO_NOTICE}</p>
        <h1 className="h-th">ทดลองสั่งซื้อ</h1>
        <div className="cart__grid">
          <form className="form" onSubmit={submit} noValidate>
            <p className="form__note">ข้อมูลในฟอร์มนี้ใช้ทดลองเท่านั้น ไม่ถูกบันทึกและไม่ถูกส่งไปที่ใด ไม่มีขั้นตอนชำระเงิน</p>
            <label className="field">ชื่อผู้รับ
              <input id="co-name" autoComplete="off" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(""); }}
                aria-invalid={Boolean(error)} aria-describedby={error ? "co-err" : undefined} />
            </label>
            {error && <p className="field__err" id="co-err" role="alert">{error}</p>}
            <label className="field">เบอร์โทร (ไม่บังคับ)
              <input id="co-phone" inputMode="tel" autoComplete="off" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="field">ที่อยู่จัดส่ง (ไม่บังคับ)
              <textarea id="co-address" autoComplete="off" rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
            <button type="submit" className="btn btn--accent btn--wide">ยืนยันทดลองสั่งซื้อ</button>
            <Link to="/trial/cart" className="linkish">กลับไปแก้ตะกร้า</Link>
          </form>
          <aside className="summary" aria-label="รายการที่ทดลองสั่ง">
            <ul className="mini">
              {payable.map((l) => (
                <li key={l.key}><span lang="en">{l.product!.name} <small>{l.variant!.label} × {l.qty}</small></span><b>{baht(l.lineTotal)}</b></li>
              ))}
            </ul>
            <p className="summary__total"><span>รวม</span><b>{baht(subtotal)}</b></p>
            {hasTest && <p className="summary__note">ใช้ราคาทดสอบ ฿100 ไม่ใช่ราคาขายจริง</p>}
          </aside>
        </div>
      </section>
    </Shell>
  );
}
