import { Link, useTitle } from "../router";
import { Shell } from "../components/ui";

export function NotFound() {
  useTitle("ไม่พบหน้านี้");
  return (
    <Shell tone="light">
      <section className="empty">
        <h1 className="h-th">ไม่พบหน้านี้</h1>
        <p>ลิงก์อาจพิมพ์ผิด หรือสินค้านี้ไม่มีในรายการแล้ว</p>
        <Link to="/trial/order" className="btn btn--navy">เลือกสินค้า</Link>
      </section>
    </Shell>
  );
}
