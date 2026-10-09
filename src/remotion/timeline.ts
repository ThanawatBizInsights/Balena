// One timeline shared by all four recipe animations (30 fps, 14 s).
// Kept free of Remotion imports so the static fallback can draw any frame
// without loading the player bundle.

export const FPS = 30;
export const WIDTH = 720;
export const HEIGHT = 900;

export const PHASES = {
  intro: [0, 66],
  ice: [66, 114],
  pour1: [114, 189],
  pour2: [189, 264],
  mix: [264, 324],
  done: [324, 366],
  end: [366, 420],
} as const;

export type PhaseName = keyof typeof PHASES;

export const DURATION = PHASES.end[1];

/** A frame where the finished drink is fully visible (used for the static view). */
export const FINISHED_FRAME = PHASES.done[0] + 20;

export function phaseAt(frame: number): PhaseName {
  for (const name of Object.keys(PHASES) as PhaseName[]) {
    if (frame < PHASES[name][1]) return name;
  }
  return "end";
}

/** 0 → 1 progress through [start, end], clamped. */
export function progress(frame: number, start: number, end: number): number {
  if (end <= start) return frame >= end ? 1 : 0;
  return Math.min(1, Math.max(0, (frame - start) / (end - start)));
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const out = [16, 8, 0].map((s) => Math.round(lerp(ch(pa, s), ch(pb, s), t)));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
