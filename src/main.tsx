import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "./styles.css";
import { App } from "./App";

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// The production build ships the page already rendered (scripts/prerender.mjs), so the
// recipes are readable before, or without, JavaScript. Attach to it instead of redrawing.
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
