import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Pages, each at its own path on the host:
//   /                    home page (cold brew hero, products, brand intro)
//   /products            the product catalogue (every product, ?p=<slug> selects one)
//   /shop                every shopping and contact channel (link page for social posts, QR codes)
//   /about               รู้จักเรา: brand story (TH/EN)
//   /cold-brew-recipes/  customer recipe page (LINE OA rich menu)
//   /cost-calculator/    internal cost and profit calculator (not linked, noindex)
//   /ops/                partners' operations app (sign-in, noindex; data in Supabase)
// vercel.json serves dist/, handles paths without a trailing slash and redirects old /trial
// addresses. The dev server gets the same no-slash addresses here.
const shopRoutes = (): Plugin => {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const [path, query] = (req.url ?? "").split(/\?(.*)/s);
    if (path === "/products" || path === "/shop" || path === "/about" || path === "/ops") req.url = `${path}/index.html${query ? `?${query}` : ""}`;
    next();
  };
  return {
    name: "shop-routes",
    configureServer: (server) => { server.middlewares.use(rewrite); },
    configurePreviewServer: (server) => { server.middlewares.use(rewrite); },
  };
};

export default defineConfig({
  base: "/",
  plugins: [react(), shopRoutes()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        home: "index.html",
        products: "products/index.html",
        shop: "shop/index.html",
        about: "about/index.html",
        notFound: "404.html",
        recipes: "cold-brew-recipes/index.html",
        costs: "cost-calculator/index.html",
        ops: "ops/index.html",
      },
    },
  },
});
