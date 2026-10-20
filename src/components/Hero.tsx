import { usePageText } from "../i18n/recipes-page";
import { assetUrl, site } from "../config/site";

export function Hero() {
  const img = site.productImage;
  const t = usePageText().hero;
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__text">
        <h1 id="hero-title" className="hero__title">{t.title}</h1>
        <p className="hero__lead">{t.lead}</p>
        <a className="btn btn--coffee hero__cta" href="#recipes">
          {t.cta}
        </a>
      </div>
      <div className="hero__photo">
        {img.src ? (
          <img
            src={assetUrl(img.src)}
            alt={t.photoAlt}
            width={img.width}
            height={img.height}
            fetchPriority="high"
            decoding="async"
          />
        ) : (
          <div className="hero__placeholder" role="img" aria-label={t.photoAlt}>
            <span>{t.photoMissing}</span>
          </div>
        )}
      </div>
    </section>
  );
}
