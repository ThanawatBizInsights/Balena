import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Three pages, each at its own path on the host:
//   /                    brand home page (TH/EN)
//   /cold-brew-recipes/  customer recipe page (LINE OA rich menu)
//   /cost-calculator/    internal cost and profit calculator (not linked, noindex)
//   /trial/...           trial storefront redesign (noindex, own client-side routes)
// vercel.json serves dist/ and handles paths without a trailing slash.
/** Sends every /trial/... page address to the trial app in dev and preview (Vercel does the
 * same through vercel.json), so /trial/order or a product page can be opened directly. */
const trialRoutes = (): Plugin => {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const path = (req.url ?? "").split("?")[0];
    if (/^\/trial(\/[^.]*)?$/.test(path)) req.url = "/trial/index.html" + (req.url!.includes("?") ? req.url!.slice(req.url!.indexOf("?")) : "");
    next();
  };
  return {
    name: "trial-routes",
    configureServer: (server) => { server.middlewares.use(rewrite); },
    configurePreviewServer: (server) => { server.middlewares.use(rewrite); },
  };
};

export default defineConfig({
  base: "/",
  plugins: [react(), trialRoutes()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        home: "index.html",
        recipes: "cold-brew-recipes/index.html",
        costs: "cost-calculator/index.html",
        trial: "trial/index.html",
      },
    },
  },
});
