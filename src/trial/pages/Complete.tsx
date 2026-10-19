import { Link, useTitle } from "../router";
import { getDemoOrder } from "../state/demoOrder";
import { baht } from "../state/pricing";
import { ProductImg, Shell } from "../components/ui";

const CONFETTI = Array.from({ length: 22 }, (_, i) => i);

export function Complete() {
  useTitle("ขอบคุณที่ทดลองสั่งซื้อ");
  const order = getDemoOrder();

  if (!order) {
    return (
      <Shell tone="light">
        <section className="empty">
          <h1 className="h-th">ยังไม่มีการทดลองสั่งซื้อ</h1>
          <p>หน้านี้แสดงผลหลังทดลองสั่งซื้อเท่านั้น และจะหายไปเมื่อโหลดหน้าใหม่</p>
          <Link to="/trial/order" className="btn btn--navy">เลือกสินค้าต่อ</Link>
        </section>
      </Shell>
    );
  }
  const shown = order.lines.slice(0, 3);
  return (
    <Shell>
      <section className="thanks" aria-labelledby="thx-title">
        <div className="confetti" aria-hidden="true">{CONFETTI.map((i) => <i key={i} style={{ ["--i" as string]: i }} />)}</div>
        <div className="thanks__bags" aria-hidden="true">
          {shown.map((l, i) => l.image && <span key={i} className="thanks__bag"><ProductImg img={l.image.images[0]} sizes="140px" /></span>)}
        </div>
        <p className="thanks__giant" lang="en" aria-hidden="true">THANK<br />YOU!</p>
        <h1 id="thx-title" className="thanks__th">ขอบคุณที่ทดลองสั่งซื้อกับ Balena</h1>
        <div className="receipt">
          <div className="receipt__head">
            <div><p className="receipt__label">เลขอ้างอิงทดลอง</p><p className="receipt__ref">{order.ref}</p></div>
            <span className="demo-pill">DEMO</span>
          </div>
          <ul className="mini">
            {order.lines.map((l, i) => (
              <li key={i}><span lang="en">{l.name} <small>{l.variant} × {l.qty}</small></span><b>{baht(l.lineTotal)}</b></li>
            ))}
          </ul>
          <p className="summary__total"><span>รวม ({order.count} ชิ้น)</span><b>{baht(order.subtotal)}</b></p>
          <p className="receipt__note">นี่คือการทดลองเท่านั้น ร้านยังไม่ได้รับคำสั่งซื้อนี้ และไม่มีการเรียกเก็บเงิน{order.hasTest ? " ยอดนี้ใช้ราคาทดสอบ" : ""}</p>
        </div>
        <Link to="/trial/order" className="btn btn--cream btn--big">เลือกสินค้าต่อ</Link>
      </section>
    </Shell>
  );
}
