import { Link, navigate, useTitle } from "../router";
import { priceLines, removeLine, setQty, useCart } from "../state/cart";
import { baht, useTestPrices } from "../state/pricing";
import { ProductImg, Qty, Shell, accentStyle } from "../components/ui";

export function Cart() {
  useTitle("ตะกร้า");
  const cart = useCart();
  const testPrices = useTestPrices();
  const { lines, subtotal, count, hasTest, hasUnavailable } = priceLines(cart, testPrices);
  const payable = lines.filter((l) => l.ok);

  return (
    <Shell tone="light">
      <section className="cart">
        <h1 className="h-th">ตะกร้า</h1>
        {lines.length === 0 ? (
          <div className="empty">
            <p>ตะกร้ายังว่าง เลือกโคลด์บรูว์หรือเมล็ดกาแฟที่ชอบได้เลย</p>
            <Link to="/trial/order" className="btn btn--navy">เลือกสินค้า</Link>
          </div>
        ) : (
          <div className="cart__grid">
            <ul className="lines">
              {lines.map((l) => (
                <li key={l.key} className={`line ${l.ok ? "" : "is-off"}`} style={l.product ? accentStyle(l.product) : undefined}>
                  <span className="line__img">{l.product && <ProductImg img={l.product.images[0]} sizes="96px" />}</span>
                  <div className="line__info">
                    <p className="line__name" lang="en">{l.product?.name ?? "สินค้านี้ไม่มีแล้ว"}</p>
                    <p className="line__sub">{l.variant?.label ?? l.variantId}{l.isTest && <span className="test-badge">ราคาทดสอบ</span>}</p>
                    {l.ok ? (
                      <p className="line__unit">{baht(l.unit!)} / ชิ้น</p>
                    ) : (
                      <p className="line__warn">สั่งไม่ได้ตอนนี้ (ยังไม่มีราคาหรือหมด) จึงไม่นับในยอดรวม</p>
                    )}
                  </div>
                  <div className="line__ctrl">
                    {l.ok && <Qty value={l.qty} onChange={(n) => setQty(l.key, n)} label={`จำนวน ${l.product?.name ?? ""}`} />}
                    <p className="line__total">{l.ok ? baht(l.lineTotal) : "—"}</p>
                    <button type="button" className="linkish" onClick={() => removeLine(l.key)}>ลบ</button>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="summary" aria-label="สรุปยอด">
              <p className="summary__row"><span>สินค้า ({payable.reduce((n, l) => n + l.qty, 0)} ชิ้น)</span><b>{baht(subtotal)}</b></p>
              <p className="summary__row"><span>ค่าจัดส่ง</span><span>แจ้งเมื่อเปิดขายจริง</span></p>
              <p className="summary__total"><span>รวม</span><b>{baht(subtotal)}</b></p>
              {hasTest && <p className="summary__note">มีสินค้าที่ใช้ราคาทดสอบ ฿100 ไม่ใช่ราคาขายจริง</p>}
              {hasUnavailable && <p className="summary__note">บางรายการสั่งไม่ได้ตอนนี้ ลบออกหรือรอราคา</p>}
              <button type="button" className="btn btn--accent btn--wide" disabled={payable.length === 0} onClick={() => navigate("/trial/checkout")}>
                ไปทดลองสั่งซื้อ
              </button>
              <Link to="/trial/order" className="linkish">เลือกสินค้าต่อ</Link>
              <p className="sr-only" aria-live="polite">ในตะกร้า {count} ชิ้น</p>
            </aside>
          </div>
        )}
      </section>
    </Shell>
  );
}
