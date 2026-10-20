import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "@fontsource/archivo-black/400.css";
import "@fontsource/kanit/600.css";
import "@fontsource/kanit/800.css";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "@fontsource/fredoka/600.css";
import "./shop.css";
import { PAGES } from "./pages";
import type { Page } from "./ui";

const root = document.getElementById("root")!;
const Page = PAGES[(root.dataset.page as Page) ?? "home"] ?? PAGES.home;
const app = (
  <StrictMode>
    <Page />
  </StrictMode>
);

// The build ships each page pre-rendered (scripts/prerender.mjs), so the text and links work
// before, or without, JavaScript. Attach to it instead of redrawing.
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
