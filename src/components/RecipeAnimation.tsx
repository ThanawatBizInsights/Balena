import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import { usePageText } from "../i18n/recipes-page";
import type { Recipe } from "../config/recipes";
import { RecipeScene } from "../remotion/RecipeScene";
import { FINISHED_FRAME, HEIGHT, WIDTH } from "../remotion/timeline";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const PlayerPanel = lazy(() => import("./PlayerPanel"));

/**
 * The animation slot under each recipe. Remotion only loads once the slot is near the
 * screen. With reduced motion, or if the player fails, a still picture of the finished
 * drink is shown instead; the recipe text above it is complete either way.
 */
export function RecipeAnimation({ recipe }: { recipe: Recipe }) {
  const page = usePageText();
  const t = page.animation;
  const reduced = usePrefersReducedMotion();
  const [optIn, setOptIn] = useState(false);
  const [near, setNear] = useState(false);
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = slot.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  const showPlayer = near && (!reduced || optIn);
  const still = <StillView recipe={recipe} />;

  return (
    <div ref={slot} className="animation">
      <h4 className="animation__title">{t.title}</h4>
      {showPlayer ? (
        <PlayerBoundary fallback={<>{still}<p className="animation__msg">{t.failed}</p></>}>
          <Suspense fallback={still}>
            <PlayerPanel key={`${recipe.id}-${page.lang}`} recipeId={recipe.id} recipeName={recipe.name} lang={page.lang} text={t} />
          </Suspense>
        </PlayerBoundary>
      ) : (
        <>
          {still}
          {reduced && (
            <button type="button" className="btn btn--outline animation__optin" onClick={() => setOptIn(true)}>
              {t.optIn}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function StillView({ recipe }: { recipe: Recipe }) {
  const t = usePageText().animation;
  return (
    <figure className="still">
      <div className="still__frame" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
        <ScaledScene>
          <RecipeScene recipe={recipe} frame={FINISHED_FRAME} />
        </ScaledScene>
      </div>
      <figcaption className="sr-only">{t.still.replace("{name}", recipe.name)}</figcaption>
    </figure>
  );
}

/** Renders the 720×900 scene scaled to the width of its box. */
function ScaledScene({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / WIDTH);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} style={{ position: "absolute", inset: 0, overflow: "hidden" }} aria-hidden="true">
      {scale > 0 && (
        <div style={{ width: WIDTH, height: HEIGHT, position: "relative", transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          {children}
        </div>
      )}
    </div>
  );
}

class PlayerBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
