import { Hero } from "./components/Hero";
import { RecipeSection } from "./components/RecipeSection";
import { Strength } from "./components/Strength";
import { Storage } from "./components/Storage";
import { FooterActions } from "./components/FooterActions";
import { ConfigNotice } from "./components/ConfigNotice";
import { site } from "./config/site";

export function App() {
  return (
    <>
      {import.meta.env.DEV && <ConfigNotice />}
      <header className="topbar">
        <span className="topbar__brand">{site.brand}</span>
      </header>
      <main>
        <Hero />
        <RecipeSection />
        <Strength />
        <Storage />
      </main>
      <FooterActions />
    </>
  );
}
