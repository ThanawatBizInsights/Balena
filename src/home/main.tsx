import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/mitr/500.css";
import "./home.css";
import { HomeApp } from "./HomeApp";

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <HomeApp />
  </StrictMode>
);

// The build ships this page pre-rendered in Thai (scripts/prerender.mjs).
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
