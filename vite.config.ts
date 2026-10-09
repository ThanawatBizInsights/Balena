import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The page lives at /cold-brew-recipes/ (the LINE rich menu links there). The build is
// written to dist/cold-brew-recipes/ so the files sit at the same path on the host as
// the URLs in the HTML. vercel.json serves dist/ and sends / to this page.
export default defineConfig({
  base: "/cold-brew-recipes/",
  plugins: [react()],
  build: {
    outDir: "dist/cold-brew-recipes",
    emptyOutDir: true,
  },
});
