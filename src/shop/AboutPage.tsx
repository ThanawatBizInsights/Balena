import { Arrow, Shell, useText } from "./ui";

const img = {
  welcome: { src: "/images/balena-welcome.webp", width: 1254, height: 1254 },
  banner: { src: "/images/balena-banner.webp", width: 2000, height: 667 },
  drinks: { src: "/images/balena-signature-drinks.webp", width: 1254, height: 1254 },
  sticker: { src: "/images/balena-whale-sticker.webp", width: 1254, height: 1254 },
};

export function AboutPage() {
  return (
    <Shell page="about">
      <AboutBody />
    </Shell>
  );
}

function AboutBody() {
  const { about: t } = useText();
  return (
      <div className="about">
        <section className="about-hero" aria-labelledby="about-title">
          <div className="about-hero__text">
            <p className="kicker" lang="en">{t.kicker}</p>
            <h1 id="about-title" className="about-hero__title">
              <span>{t.title[0]}</span> <span lang="en">{t.title[1]}</span>
            </h1>
            <p className="about-hero__lead">{t.lead}</p>
            <p className="about-hero__tag" lang="en">Big whale. Small batch.</p>
          </div>
          <figure className="about-hero__poster">
            <img src={img.welcome.src} width={img.welcome.width} height={img.welcome.height} alt={t.alt.welcome}
              fetchPriority="high" decoding="async" />
          </figure>
        </section>

        <section className="story" id="story" aria-labelledby="story-title">
          <img className="story__whale" src={img.sticker.src} width={img.sticker.width} height={img.sticker.height}
            alt={t.alt.sticker} loading="lazy" decoding="async" />
          <div className="story__text">
            <h2 id="story-title" className="h-th">{t.story.title}</h2>
            <p>{t.story.p1}</p>
            <p>{t.story.p2}</p>
            <p className="story__sign" lang="en">{t.story.sign}</p>
          </div>
        </section>

        <section className="make" id="make" aria-labelledby="make-title">
          <div className="make__in">
            <div className="make__head">
              <h2 id="make-title" className="h-th">{t.make.title}</h2>
              <p>{t.make.lead}</p>
            </div>
            <img className="make__banner" src={img.banner.src} width={img.banner.width} height={img.banner.height}
              alt={t.alt.banner} loading="lazy" decoding="async" />
            <div className="make__grid">
              <article className="make__card">
                <h3>{t.make.coldbrew.name}</h3>
                <p>{t.make.coldbrew.text}</p>
                <ul className="ticks">{t.make.coldbrew.points.map((p) => <li key={p}>{p}</li>)}</ul>
                <a className="btn btn--navy" href="/products#cold-brew">{t.make.coldbrew.cta} <Arrow /></a>
              </article>
              <article className="make__card">
                <h3>{t.make.beans.name}</h3>
                <p>{t.make.beans.text}</p>
                <a className="btn btn--navy" href="/products#coffee-beans">{t.make.beans.cta} <Arrow /></a>
              </article>
            </div>
          </div>
        </section>

        <section className="drinks" id="drinks" aria-labelledby="drinks-title">
          <div className="drinks__in">
            <img className="drinks__poster" src={img.drinks.src} width={img.drinks.width} height={img.drinks.height}
              alt={t.alt.drinks} loading="lazy" decoding="async" />
            <div className="drinks__text">
              <h2 id="drinks-title" className="h-th">{t.drinks.title}</h2>
              <p>{t.drinks.lead}</p>
              <ol className="drinks__list">{t.drinks.items.map((d) => <li key={d}>{d}</li>)}</ol>
              <p className="drinks__home">
                {t.drinks.home} <a className="linkish" href="/cold-brew-recipes/">{t.drinks.homeLink} <Arrow /></a>
              </p>
            </div>
          </div>
        </section>
      </div>
  );
}
