import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The page is served under /cold-brew-recipes/ (the LINE rich menu links there).
export default defineConfig({
  base: "/cold-brew-recipes/",
  plugins: [react()],
});
