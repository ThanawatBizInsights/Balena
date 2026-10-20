import { Hero } from "./components/Hero";
import { RecipeSection } from "./components/RecipeSection";
import { Strength } from "./components/Strength";
import { Storage } from "./components/Storage";
import { FooterActions } from "./components/FooterActions";
import { ConfigNotice } from "./components/ConfigNotice";
import { site } from "./config/site";
import { setLang, useDocumentLang } from "./i18n/lang";
import { usePageText } from "./i18n/recipes-page";

export function App() {
  const t = usePageText();
  useDocumentLang(t.lang, t.meta);
  return (
    <div className={`lang-${t.lang}`}>
      {import.meta.env.DEV && <ConfigNotice />}
      <header className="topbar">
        <a className="topbar__brand" href="/" lang="en">{site.brand}</a>
        <nav className="topbar__nav" aria-label={t.nav.mainMenu}>
          <a href="/">{t.nav.home}</a>
          <a href="/products">{t.nav.products}</a>
        </nav>
        <div className="topbar__lang" role="group" aria-label={t.nav.language}>
          {(["th", "en"] as const).map((l) => (
            <button key={l} type="button" lang={l} aria-pressed={t.lang === l} onClick={() => setLang(l)}
              aria-label={l === "th" ? "ภาษาไทย" : "English"}>
              {l === "th" ? "TH" : "EN"}
            </button>
          ))}
        </div>
      </header>
      <main>
        <Hero />
        <RecipeSection />
        <Strength />
        <Storage />
      </main>
      <FooterActions />
    </div>
  );
}
