import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { App } from "./App";

export { LANG_BOOT_SCRIPT } from "./i18n/lang";

/** Used at build time (scripts/prerender.mjs) to put the page text into index.html. */
export function render(): string {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
