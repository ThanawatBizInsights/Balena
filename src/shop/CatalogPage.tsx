import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { CATEGORIES, bySlug, factsOf, inCategory, type Category, type Product } from "../data/products";
import { fill } from "../i18n/shop";
import { Arrow, NoteTags, ProductImg, PurchaseLinks, Shell, SoonBadge, accentStyle, useText } from "./ui";

/*
 * Every product on one page: cold brew first (#cold-brew), coffee beans below (#coffee-beans).
 * Each section has its own selection. The address holds the last chosen product as ?p=<slug>
 * (the same format the trial order page used), so a link opens that product, and refresh and
 * back/forward keep it.
 */

const URL_EVENT = "balena:url";
const subscribe = (l: () => void) => {
  addEventListener("popstate", l);
  addEventListener(URL_EVENT, l);
  return () => { removeEventListener("popstate", l); removeEventListener(URL_EVENT, l); };
};
/** ?p= from the address; "" while pre-rendering and during hydration. */
const useSlugParam = () => useSyncExternalStore(subscribe, () => new URLSearchParams(location.search).get("p") ?? "", () => "");

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const anchor = (c: Category) => CATEGORIES.find((x) => x.id === c)!.anchor;

export function CatalogPage() {
  const param = useSlugParam();
  const [selected, setSelected] = useState<Record<Category, string>>({
    "cold-brew": inCategory("cold-brew")[0].slug,
    beans: inCategory("beans")[0].slug,
  });
  // Until the visitor picks something here, a product in the address also scrolls to it.
  const fromLink = useRef(true);

  // Address → selection (first load, refresh, back/forward, links on this page).
  useEffect(() => {
    const p = bySlug(param);
    if (!p) {
      // Unknown slug: show the defaults and drop it from the address.
      if (param) history.replaceState(history.state, "", location.pathname + location.hash);
      return;
    }
    setSelected((s) => (s[p.category] === p.slug ? s : { ...s, [p.category]: p.slug }));
    if (fromLink.current) {
      fromLink.current = false;
      // Opened from a product link: bring its section into view once the selection is drawn.
      requestAnimationFrame(() => document.getElementById(anchor(p.category))?.scrollIntoView({ block: "start" }));
    }
  }, [param]);

  const choose = (p: Product) => {
    fromLink.current = false;
    setSelected((s) => ({ ...s, [p.category]: p.slug }));
    if (bySlug(param)?.slug === p.slug) return;
    history.pushState(null, "", `/products?p=${p.slug}#${anchor(p.category)}`);
    dispatchEvent(new Event(URL_EVENT));
  };

  return (
    <Shell page="products" tone="light">
      <CatalogTop />
      {CATEGORIES.map((c) => (
        <CategorySection key={c.id} category={c.id} id={c.anchor} current={bySlug(selected[c.id])!} onChoose={choose} />
      ))}
    </Shell>
  );
}

function CatalogTop() {
  const t = useText();
  return (
    <div className="cat-top">
      <p className="kicker" lang="en">Our products</p>
      <h1 className="h-th">{t.catalog.title}</h1>
      <nav className="cat-top__jump" aria-label={t.catalog.categoriesLabel}>
        {CATEGORIES.map((c) => <a key={c.id} className="pill" href={`#${c.anchor}`}>{t.categories[c.id]}</a>)}
      </nav>
    </div>
  );
}

const KICKER: Record<Category, string> = { "cold-brew": "Cold Brew", beans: "Coffee Beans" };

function CategorySection({ category, id, current, onChoose }: {
  category: Category; id: string; current: Product; onChoose: (p: Product) => void;
}) {
  const t = useText();
  const title = t.categories[category];
  const list = inCategory(category);
  const idx = list.indexOf(current);
  const tabs = useRef<HTMLDivElement>(null);
  const [imgIndex, setImgIndex] = useState(0);
  useEffect(() => setImgIndex(0), [current]);

  // Keep the chosen thumbnail visible in the strip.
  useEffect(() => {
    const el = tabs.current?.querySelector<HTMLElement>(`[data-slug="${current.slug}"]`);
    const strip = tabs.current;
    if (!el || !strip || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2, behavior: reduceMotion() ? "auto" : "smooth" });
  }, [current]);

  const step = (d: number, focus = false) => {
    const next = list[(idx + d + list.length) % list.length];
    onChoose(next);
    if (focus) tabs.current?.querySelector<HTMLElement>(`[data-slug="${next.slug}"]`)?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const moves: Record<string, () => void> = {
      ArrowRight: () => step(1, true),
      ArrowLeft: () => step(-1, true),
      Home: () => step(-idx, true),
      End: () => step(list.length - 1 - idx, true),
    };
    if (moves[e.key]) { e.preventDefault(); moves[e.key](); }
  };

  const panelId = `${id}-panel`;
  const tabId = (p: Product) => `${id}-tab-${p.slug}`;
  const img = current.images[Math.min(imgIndex, current.images.length - 1)];
  const facts = factsOf(current, t.lang);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section className={`catalog catalog--${category}`} id={id} aria-labelledby={`${id}-title`} style={accentStyle(current)}>
      <div className="catalog__in">
        <div className="catalog__head">
          <p className="kicker" lang="en">{KICKER[category]}</p>
          <h2 id={`${id}-title`} className="h-th">{title}</h2>
          <p className="catalog__count">{fill(t.catalog.count, { count: list.length.toLocaleString(t.lang) })}</p>
        </div>

        <div className="catalog__tabs" ref={tabs} role="tablist" aria-label={fill(t.catalog.choose, { category: title })} onKeyDown={onKey}>
          {list.map((p) => (
            <button key={p.slug} type="button" role="tab" id={tabId(p)} data-slug={p.slug}
              aria-selected={p === current} aria-controls={panelId} tabIndex={p === current ? 0 : -1}
              className={`chip ${p === current ? "is-on" : ""}`} style={accentStyle(p)} onClick={() => onChoose(p)}>
              <span className="chip__img"><ProductImg img={p.images[0]} sizes="80px" /></span>
              <span className="chip__text">
                <span className="chip__name" lang="en">{p.shortName}</span>
                <span className="chip__size">{p.status === "planned" ? `${p.size} · ${t.catalog.soon}` : p.size}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="catalog__main" id={panelId} role="tabpanel" aria-labelledby={tabId(current)}>
          <div className="catalog__visual">
            <p className="catalog__giant" aria-hidden="true" lang="en">{current.shortName.split(" ")[0].toUpperCase()}</p>
            <div className="catalog__img" key={`${current.slug}-${img?.file ?? "none"}`}>
              <ProductImg img={img} eager={category === "cold-brew"} sizes="(min-width: 900px) 40vw, 80vw" />
            </div>
            {current.images.length > 1 && (
              <div className="catalog__pics" role="group" aria-label={t.catalog.photos}>
                {current.images.map((im, i) => (
                  <button key={im.file} type="button" aria-pressed={i === imgIndex} aria-label={fill(t.catalog.photo, { n: i + 1, alt: im.alt[t.lang] })}
                    className={i === imgIndex ? "is-on" : ""} onClick={() => setImgIndex(i)}>
                    <ProductImg img={im} sizes="64px" />
                  </button>
                ))}
              </div>
            )}
            {list.length > 1 && (
              <div className="catalog__arrows">
                <button type="button" className="round round--light" onClick={() => step(-1)} aria-label={fill(t.catalog.previous, { category: title })}>←</button>
                <span aria-hidden="true">{pad(idx + 1)} / {pad(list.length)}</span>
                <button type="button" className="round round--light" onClick={() => step(1)} aria-label={fill(t.catalog.next, { category: title })}>→</button>
              </div>
            )}
          </div>

          <article className="catalog__panel" key={current.slug}>
            <h3 className="catalog__name" lang="en">{current.name}</h3>
            <p className="catalog__sub" lang="en">{current.subtitle}</p>
            {current.status === "planned" && <p><SoonBadge /></p>}
            <p className="catalog__benefit">{current.benefit[t.lang]}</p>
            <p className="catalog__intro">{current.story[t.lang]}</p>
            <PurchaseLinks product={current} heading={t.buy.headingProduct} />
            <div className="catalog__block">
              <h4>{t.catalog.notes}</h4>
              <NoteTags product={current} />
              <p className="catalog__hint">{t.catalog.notesHint}</p>
            </div>
            <div className="catalog__block">
              <h4>{t.catalog.whoFor}</h4>
              <p>{current.whoFor[t.lang]}</p>
            </div>
            <div className="catalog__block">
              <h4>{t.catalog.drinks}</h4>
              <ul className="drink-list">{current.drinks.map((d) => <li key={d.en}>{d[t.lang]}</li>)}</ul>
            </div>
            <div className="catalog__block">
              <h4>{t.catalog.details}</h4>
              <dl className="specs">
                {facts.map((f) => (
                  <div key={f.key}><dt>{t.catalog.facts[f.key]}</dt><dd lang={f.en ? "en" : undefined}>{f.value}</dd></div>
                ))}
                {current.batchDependent && (
                  <div><dt>{t.catalog.facts.batch}</dt><dd>{t.catalog.batch}<span className="specs__note">{t.catalog.batchText}</span></dd></div>
                )}
              </dl>
            </div>
            {current.use && (
              <div className="catalog__use">
                <p className="catalog__use-h">{t.catalog.use}</p>
                <p>{current.use.text[t.lang]}</p>
                {current.use.link && <a className="linkish" href={current.use.link.href}>{current.use.link.label[t.lang]} <Arrow /></a>}
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
