import { useEffect, useState } from "react";
import type { Product } from "../data/products";
import { Link } from "../router";
import { addToCart } from "../state/cart";
import { baht, priceOf, useTestPrices } from "../state/pricing";
import { PriceTag, Qty, showToast } from "./ui";

/** Size pills, quantity, live total and add to cart. Used by the order and product pages. */
export function BuyPanel({ product, compact = false }: { product: Product; compact?: boolean }) {
  const testPrices = useTestPrices();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [qty, setQty] = useState(1);
  useEffect(() => { setVariantId(product.variants[0].id); setQty(1); }, [product]);
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const info = priceOf(variant, testPrices);
  const canBuy = info.amount != null;

  const add = () => {
    if (!canBuy) return;
    addToCart(product.id, variant.id, qty);
    showToast(`ใส่ ${product.name} ${variant.label} × ${qty} ลงตะกร้าแล้ว`);
  };

  return (
    <div className={`buy ${compact ? "is-compact" : ""}`}>
      <fieldset className="buy__sizes">
        <legend>ขนาด</legend>
        <div className="pills">
          {product.variants.map((v) => (
            <label key={v.id} className={`pill ${v.id === variantId ? "is-on" : ""} ${v.available ? "" : "is-off"}`}>
              <input type="radio" name={`size-${product.id}`} value={v.id} checked={v.id === variantId} disabled={!v.available}
                onChange={() => setVariantId(v.id)} />
              {v.label}
            </label>
          ))}
        </div>
        {product.category === "beans" && <p className="buy__hint">ขายเป็นเมล็ด (Whole Bean) ตามฉลาก</p>}
      </fieldset>

      <div className="buy__row">
        <div>
          <p className="buy__label">ราคา</p>
          <PriceTag info={info} big />
        </div>
        {canBuy && <Qty value={qty} onChange={setQty} label={`จำนวน ${product.name}`} />}
      </div>

      {canBuy ? (
        <>
          <p className="buy__total" aria-live="polite">รวม <b>{baht(info.amount! * qty)}</b></p>
          <button type="button" className="btn btn--accent btn--wide" onClick={add}>ใส่ตะกร้า</button>
        </>
      ) : (
        <div className="buy__ask">
          <p>ยังไม่เปิดสั่งออนไลน์สำหรับสินค้านี้ สอบถามราคาได้ทางช่องทางติดต่อของร้าน</p>
          <button type="button" className="btn btn--wide" disabled>ยังสั่งซื้อไม่ได้</button>
        </div>
      )}
      {!compact && <Link className="buy__cart" to="/trial/cart">ไปที่ตะกร้า →</Link>}
    </div>
  );
}
