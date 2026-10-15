import { assetUrl, site } from "../config/site";

export function Hero() {
  const img = site.productImage;
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__text">
        <h1 id="hero-title" className="hero__title">ชงแก้วโปรดง่าย{"\u00A0"}ๆ กับ Balena</h1>
        <p className="hero__lead">
          Cold Brew Concentrate สูตร Original ผสมได้หลายเมนู ปรับความเข้มได้ตามใจ
        </p>
        <a className="btn btn--coffee hero__cta" href="#recipes">
          เลือกเมนูที่อยากลอง
        </a>
      </div>
      <div className="hero__photo">
        {img.src ? (
          <img
            src={assetUrl(img.src)}
            alt={img.alt}
            width={img.width}
            height={img.height}
            fetchPriority="high"
            decoding="async"
          />
        ) : (
          <div className="hero__placeholder" role="img" aria-label={img.alt}>
            <span>รูปสินค้า Balena Cold Brew</span>
          </div>
        )}
      </div>
    </section>
  );
}
