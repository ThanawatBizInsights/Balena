import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { PAGES } from "./pages";
import type { Page } from "./ui";

export { LANG_BOOT_SCRIPT } from "../i18n/lang";

/** Used at build time (scripts/prerender.mjs) to put each shop page's HTML into its file. */
export function render(page: Page): string {
  const Page = PAGES[page];
  return renderToString(
    <StrictMode>
      <Page />
    </StrictMode>,
  );
}
