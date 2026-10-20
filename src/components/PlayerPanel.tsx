import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { findRecipe, type Lang } from "../config/recipes";
import type { RecipesPageText } from "../i18n/recipes-page";
import { RecipeComposition } from "../remotion/RecipeComposition";
import { RecipeScene } from "../remotion/RecipeScene";
import { DURATION, FPS, HEIGHT, PHASES, WIDTH } from "../remotion/timeline";

// Loaded lazily (see RecipeAnimation) so Remotion doesn't delay the page text and photo.

type Status = "idle" | "playing" | "paused" | "ended";

export default function PlayerPanel({ recipeId, recipeName, lang, text: t }: {
  recipeId: string; recipeName: string; lang: Lang; text: RecipesPageText["animation"];
}) {
  const ref = useRef<PlayerRef>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const player = ref.current;
    if (!player) return;
    const onPlay = () => setStatus("playing");
    const onPause = () => setStatus((s) => (s === "ended" ? s : "paused"));
    const onEnded = () => setStatus("ended");
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onEnded);
    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onEnded);
    };
  }, []);

  const play = () => {
    if (status === "ended") ref.current?.seekTo(0);
    ref.current?.play();
  };
  const replay = () => {
    const player = ref.current;
    if (!player) return;
    // Stop first: seeking while playing leaves the player's clock running from the
    // old position, and it then never reports the end.
    player.pause();
    player.seekTo(0);
    requestAnimationFrame(() => player.play());
  };

  return (
    <div className="player">
      <div className="player__frame">
        <Player
          ref={ref}
          component={RecipeComposition}
          inputProps={{ recipeId, lang }}
          durationInFrames={DURATION}
          fps={FPS}
          compositionWidth={WIDTH}
          compositionHeight={HEIGHT}
          style={{ width: "100%" }}
          controls={false}
          showVolumeControls={false}
          allowFullscreen={false}
          doubleClickToFullscreen={false}
          clickToPlay
          autoPlay={false}
          // Before the first play, show the empty glass with every ingredient listed.
          showPosterWhenUnplayed
          renderPoster={() => (
            <div style={{ position: "absolute", inset: 0, cursor: "pointer" }}>
              <RecipeScene recipe={findRecipe(recipeId, lang)} frame={PHASES.intro[1] - 1} />
            </div>
          )}
          posterFillMode="composition-size"
          loop={false}
          moveToBeginningWhenEnded={false}
        />
      </div>
      <div className="player__buttons" role="group" aria-label={t.controls.replace("{name}", recipeName)}>
        {status === "playing" ? (
          <button type="button" className="btn btn--ocean" onClick={() => ref.current?.pause()}>
            <PauseIcon /> {t.pause}
          </button>
        ) : (
          <button type="button" className="btn btn--ocean" onClick={play}>
            <PlayIcon /> {status === "paused" ? t.resume : t.play}
          </button>
        )}
        <button type="button" className="btn btn--outline" onClick={replay} disabled={status === "idle"}>
          <ReplayIcon /> {t.replay}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {status === "playing" ? t.playing : status === "paused" ? t.paused : status === "ended" ? t.ended : ""}
      </p>
    </div>
  );
}

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z" fill="currentColor" /></svg>
);
const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 4h4v12H5zM11 4h4v12h-4z" fill="currentColor" /></svg>
);
const ReplayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4a6 6 0 1 1-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><path d="M10 1v6L6 4z" fill="currentColor" /></svg>
);
