import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "../styles.css";
import "./cost.css";
import { CostApp } from "./CostApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CostApp />
  </StrictMode>,
);
