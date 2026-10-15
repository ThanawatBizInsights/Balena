// Dev-only contact sheet: `npm run dev`, then open /cold-brew-recipes/dev/frames.html
// Shows key frames of every recipe animation for review after editing recipes.ts.
import { createRoot } from "react-dom/client";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import { recipes } from "../src/config/recipes";
import { RecipeScene } from "../src/remotion/RecipeScene";
import { FPS, HEIGHT, WIDTH } from "../src/remotion/timeline";

const frames = [10, 65, 100, 150, 175, 225, 250, 290, 340, 400];
const S = 0.3;

createRoot(document.getElementById("root")!).render(
  <div style={{ display: "grid", gap: 8, padding: 8 }}>
    {recipes.map((r) => (
      <div key={r.id} style={{ display: "flex", gap: 6 }}>
        {frames.map((f) => (
          <div key={f} style={{ width: WIDTH * S, height: HEIGHT * S + 18, overflow: "hidden", position: "relative", background: "#fff" }}>
            <div style={{ position: "absolute", top: 0, width: WIDTH, height: HEIGHT, transform: `scale(${S})`, transformOrigin: "0 0" }}>
              <RecipeScene recipe={r} frame={f} />
            </div>
            <span style={{ position: "absolute", bottom: 0, left: 4, font: "12px sans-serif" }}>{(f / FPS).toFixed(1)}s</span>
          </div>
        ))}
      </div>
    ))}
  </div>,
);
