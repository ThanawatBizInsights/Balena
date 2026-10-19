import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/archivo-black/400.css";
import "@fontsource/kanit/600.css";
import "@fontsource/kanit/800.css";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "@fontsource/fredoka/600.css";
import "./trial.css";
import { TrialApp } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TrialApp />
  </StrictMode>,
);
