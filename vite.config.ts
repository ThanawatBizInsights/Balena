import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Three pages, each at its own path on the host:
//   /                    brand home page (TH/EN)
//   /cold-brew-recipes/  customer recipe page (LINE OA rich menu)
//   /cost-calculator/    internal cost and profit calculator (not linked, noindex)
// vercel.json serves dist/ and handles paths without a trailing slash.
export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        home: "index.html",
        recipes: "cold-brew-recipes/index.html",
        costs: "cost-calculator/index.html",
      },
    },
  },
});
