import { AboutPage } from "./AboutPage";
import { CatalogPage } from "./CatalogPage";
import { HomePage } from "./HomePage";
import { NotFoundPage } from "./NotFoundPage";
import type { Page } from "./ui";

/** The public shop pages. Each HTML entry names its page in <div id="root" data-page>. */
export const PAGES: Record<Page, () => React.JSX.Element> = {
  home: HomePage,
  products: CatalogPage,
  about: AboutPage,
  notFound: NotFoundPage,
};
