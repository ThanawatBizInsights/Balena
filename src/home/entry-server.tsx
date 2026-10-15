import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { HomeApp } from "./HomeApp";

/** Used at build time (scripts/prerender.mjs) to put the home page text into index.html. */
export function render(): string {
  return renderToString(
    <StrictMode>
      <HomeApp />
    </StrictMode>,
  );
}
