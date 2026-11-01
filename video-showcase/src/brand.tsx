// Balena brand tokens and shared building blocks for the showcase video.
import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { continueRender, delayRender, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import boxesJson from "../public/shots/boxes.json";

export const C = {
  navy: "#0A1F4D", ocean: "#145A8C", oceanDeep: "#0E4269", sky: "#D6EAF6", skySoft: "#EAF4FA", cream: "#FBF5EA", paper: "#FFFFFF",
  ink: "#22303A", muted: "#5E554C", line: "#E2D6C2", teal: "#0F7A68", amber: "#C98A12", amberSoft: "#FFF1D1", red: "#B3261E",
};
export const FONT_TH = "'Kanit', 'Noto Sans Thai', sans-serif";
export const FONT_BODY = "'Noto Sans Thai', sans-serif";
export const FONT_WORD = "'Archivo Black', 'Kanit', sans-serif";
export const EASE = Easing.bezier(0.33, 0, 0.2, 1);
export const OUT = Easing.bezier(0.16, 1, 0.3, 1);

const FONTS: [string, string, string][] = [
  ["Kanit", "kanit-thai-500-normal.woff2", "500"], ["Kanit", "kanit-latin-500-normal.woff2", "500"],
  ["Kanit", "kanit-thai-600-normal.woff2", "600"], ["Kanit", "kanit-latin-600-normal.woff2", "600"],
  ["Noto Sans Thai", "noto-sans-thai-thai-400-normal.woff2", "400"], ["Noto Sans Thai", "noto-sans-thai-latin-400-normal.woff2", "400"],
  ["Noto Sans Thai", "noto-sans-thai-thai-600-normal.woff2", "600"], ["Noto Sans Thai", "noto-sans-thai-latin-600-normal.woff2", "600"],
  ["Archivo Black", "archivo-black-latin-400-normal.woff2", "400"],
];
/** Loads the brand fonts before the first frame renders. */
export function useFonts() {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all(FONTS.map(([family, file, weight]) => {
      const f = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, { weight });
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(f);
      return f.load();
    })).then(() => continueRender(handle), () => continueRender(handle));
  }, [handle]);
}

// ---------- element boxes recorded at capture time ----------
export type Box = { x: number; y: number; w: number; h: number; text?: string };
type Scene = { viewport: { width: number; height: number; scale: number }; page: { w: number; h: number }; els: Record<string, Box[]> };
export const boxes = boxesJson as unknown as Record<string, Scene>;
export function box(scene: string, sel: string, match: number | string = 0): Box {
  const list = boxes[scene]?.els[sel] ?? [];
  const b = typeof match === "number" ? list[match] : list.find((x) => (x.text ?? "").includes(match));
  if (!b) throw new Error(`box not found: ${scene} ${sel} ${match}`);
  return b;
}
export const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

// ---------- camera over a full-page screenshot ----------
export type Rect = { x: number; y: number; w: number };
type Key = [number, Rect];
export function camera(frame: number, keys: Key[]): Rect {
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, a] = keys[i], [f1, b] = keys[i + 1];
    if (frame <= f1) {
      const p = EASE(Math.min(1, Math.max(0, (frame - f0) / Math.max(1, f1 - f0))));
      return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p };
    }
  }
  return keys[keys.length - 1][1];
}

/** A screenshot seen through a camera rect (CSS px of the captured page). Children are in page coordinates. */
export function Shot({ scene, rect, width, height, children, style }: {
  scene: string; rect: Rect; width: number; height: number; children?: ReactNode; style?: CSSProperties;
}) {
  const s = width / rect.w;
  const p = boxes[scene].page;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", width, height, background: C.cream, ...style }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: p.w, height: p.h, transformOrigin: "0 0",
        transform: `translate(${-rect.x * s}px, ${-rect.y * s}px) scale(${s})` }}>
        <Img src={staticFile(`shots/${scene}.png`)} style={{ width: p.w, height: p.h, display: "block" }} />
        <ScaleContext.Provider value={s}>{children}</ScaleContext.Provider>
      </div>
    </div>
  );
}
const ScaleContext = createContext(1);

/** Soft glow outline around an element (page coords), drawn in after `start`. */
export function Highlight({ b, start, end = 1e9, pad = 8, radius = 16, color = C.ocean, wiggle = false }: {
  b: Box; start: number; end?: number; pad?: number; radius?: number; color?: string; wiggle?: boolean;
}) {
  const f = useCurrentFrame();
  const currentScale = useContext(ScaleContext);
  // Short spans shrink the fades so the keyframes stay in order.
  const inLen = Math.min(10, (end - start) / 3), outLen = Math.min(8, (end - start) / 3);
  const o = interpolate(f, [start, start + inLen, end - outLen, end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sc = interpolate(f, [start, start + 14], [1.06, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  return (
    <div style={{ position: "absolute", left: b.x - pad, top: b.y - pad, width: b.w + pad * 2, height: b.h + pad * 2, borderRadius: radius,
      border: `${3 / currentScale}px solid ${color}`, boxShadow: `0 0 0 ${8 / currentScale}px ${color}22, 0 ${8 / currentScale}px ${30 / currentScale}px ${color}33`,
      opacity: o, pointerEvents: "none",
      // A short, decaying wiggle when a button is pressed; no loops.
      transform: `scale(${sc}) rotate(${wiggle ? Math.sin((f - start) * 1.6) * 2.4 * Math.max(0, 1 - (f - start) / 14) : 0}deg)` }} />
  );
}

/** Cursor moving through page-coordinate points; a click ripple at each `click` frame. */
export function Cursor({ path, clicks = [] }: { path: [number, number, number][]; clicks?: number[] }) {
  const f = useCurrentFrame();
  let x = path[0][1], y = path[0][2];
  for (let i = 0; i < path.length - 1; i++) {
    const [f0, x0, y0] = path[i], [f1, x1, y1] = path[i + 1];
    if (f >= f0) {
      const p = EASE(Math.min(1, Math.max(0, (f - f0) / Math.max(1, f1 - f0))));
      x = x0 + (x1 - x0) * p; y = y0 + (y1 - y0) * p;
    }
  }
  const k = 1 / useContext(ScaleContext);
  const appear = interpolate(f, [path[0][0] - 8, path[0][0]], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pressed = clicks.some((c) => f >= c && f < c + 5);
  return (
    <>
      {clicks.map((c) => {
        const t = f - c;
        if (t < 0 || t > 22) return null;
        const r = interpolate(t, [0, 22], [8, 46], { easing: OUT });
        return <div key={c} style={{ position: "absolute", left: x - r * k, top: y - r * k, width: r * 2 * k, height: r * 2 * k, borderRadius: "50%",
          border: `${3 * k}px solid ${C.ocean}`, opacity: interpolate(t, [0, 22], [0.9, 0]) }} />;
      })}
      <svg width={34 * k} height={40 * k} viewBox="0 0 34 40" style={{ position: "absolute", left: x - 4 * k, top: y - 2 * k, opacity: appear,
        transform: `scale(${pressed ? 0.88 : 1})`, transformOrigin: "4px 2px", filter: `drop-shadow(0 ${3 * k}px ${5 * k}px rgba(10,31,77,.35))` }}>
        <path d="M4 2 L4 31 L11.5 24 L17 37 L22.5 34.6 L17 22 L27.5 22 Z" fill="#fff" stroke={C.navy} strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
    </>
  );
}

// ---------- frames ----------
export function BrowserFrame({ x, y, w, h, children, enter = 0 }: { x: number; y: number; w: number; h: number; children: ReactNode; enter?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: f - enter, fps, config: { damping: 200 }, durationInFrames: 22 });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: 22, overflow: "hidden", background: C.paper,
      boxShadow: "0 30px 80px rgba(10,31,77,.22), 0 4px 14px rgba(10,31,77,.08)", border: "1px solid rgba(10,31,77,.08)",
      opacity: sp, transform: `translateY(${(1 - sp) * 40}px) scale(${0.97 + sp * 0.03})` }}>
      <div style={{ height: 44, background: "#F3EEE4", display: "flex", alignItems: "center", gap: 9, padding: "0 18px", borderBottom: "1px solid #E7DECF" }}>
        {["#E7B0A6", "#EED39C", "#B9D9C4"].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
        <span style={{ marginLeft: 18, height: 24, flex: "0 1 420px", borderRadius: 12, background: "#E9E1D3" }} />
      </div>
      <div style={{ position: "absolute", left: 0, top: 44, width: w, height: h - 44 }}>{children}</div>
    </div>
  );
}

export function PhoneFrame({ x, y, w, h, children, enter = 0 }: { x: number; y: number; w: number; h: number; children: ReactNode; enter?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: f - enter, fps, config: { damping: 200 }, durationInFrames: 22 });
  return (
    <div style={{ position: "absolute", left: x - 16, top: y - 16, width: w + 32, height: h + 32, borderRadius: 64, background: C.navy, padding: 16,
      boxShadow: "0 40px 90px rgba(10,31,77,.3)", opacity: sp, transform: `translateY(${(1 - sp) * 60}px)` }}>
      <div style={{ position: "relative", width: w, height: h, borderRadius: 50, overflow: "hidden", background: C.cream }}>{children}</div>
    </div>
  );
}

// ---------- captions and labels ----------
export function Caption({ th, en, sub, start, end, x, y, width, size = 64, align = "left" }: {
  th: string[]; en?: string; sub?: string; start: number; end: number; x: number; y: number; width: number; size?: number; align?: "left" | "center";
}) {
  const f = useCurrentFrame();
  const o = interpolate(f, [start, start + 12, end - 10, end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: x, top: y, width, opacity: o, textAlign: align }}>
      {en && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 18px", borderRadius: 999, background: C.navy, color: "#fff",
          fontFamily: FONT_TH, fontWeight: 500, fontSize: size * 0.4, letterSpacing: "0.02em", marginBottom: size * 0.35,
          transform: `translateY(${interpolate(f, [start, start + 14], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT })}px)` }}>
          <span style={{ width: size * 0.16, height: size * 0.16, borderRadius: 99, background: "#5FB3E6" }} />{en}
        </div>
      )}
      {th.map((line, i) => {
        const s = start + 4 + i * 6;
        const p = interpolate(f, [s, s + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
        return (
          <div key={i} style={{ overflow: "hidden", paddingBottom: size * 0.08 }}>
            <div lang="th" style={{ fontFamily: FONT_TH, fontWeight: 600, fontSize: size, lineHeight: 1.32, color: C.navy, whiteSpace: "nowrap",
              transform: `translateY(${(1 - p) * 100}%)`, opacity: p }}>{line}</div>
          </div>
        );
      })}
      {sub && <div lang="th" style={{ fontFamily: FONT_BODY, fontSize: size * 0.42, lineHeight: 1.7, color: C.muted, marginTop: size * 0.2 }}>{sub}</div>}
    </div>
  );
}

/** "ข้อมูลตัวอย่าง / Demo data" badge on every interface scene. */
export function DemoBadge({ x, y, size = 22 }: { x: number; y: number; size?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: 10, padding: `${size * 0.35}px ${size * 0.8}px`, borderRadius: 999,
      background: C.amberSoft, border: `2px solid ${C.amber}55`, color: "#6B4C00", fontFamily: FONT_TH, fontWeight: 500, fontSize: size }}>
      <span style={{ width: size * 0.5, height: size * 0.5, borderRadius: 99, background: C.amber }} />
      ข้อมูลตัวอย่าง / Demo data
    </div>
  );
}

export function Whale({ size, style }: { size: number; style?: CSSProperties }) {
  return <Img src={staticFile("brand/balena-whale-sticker.webp")} style={{ width: size, height: size, borderRadius: "50%", boxShadow: "0 18px 50px rgba(10,31,77,.25)", ...style }} />;
}

export function Wordmark({ size, color = C.navy }: { size: number; color?: string }) {
  return (
    <div lang="en" style={{ fontFamily: FONT_WORD, color, fontSize: size, lineHeight: 1, display: "flex", alignItems: "baseline", gap: size * 0.25 }}>
      Balena<span style={{ fontFamily: FONT_TH, fontWeight: 500, fontSize: size * 0.42, letterSpacing: "0.18em", textTransform: "uppercase" }}>Roastery</span>
    </div>
  );
}

/** Floating card that counts up to a value shown in the interface (never beyond it). */
export function CountChip({ label, value, format, start, x, y, size = 30, tone = "navy" }: {
  label: string; value: number; format: (n: number) => string; start: number; x: number; y: number; size?: number; tone?: "navy" | "amber";
}) {
  const f = useCurrentFrame();
  const p = interpolate(f, [start, start + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  const n = interpolate(f, [start + 4, start + 30], [0, value], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  return (
    <div style={{ position: "absolute", left: x, top: y, padding: `${size * 0.5}px ${size * 0.8}px`, borderRadius: size * 0.7, background: tone === "navy" ? C.navy : C.amberSoft,
      color: tone === "navy" ? "#fff" : "#6B4C00", boxShadow: "0 20px 50px rgba(10,31,77,.28)", opacity: p, transform: `translateY(${(1 - p) * 30}px) scale(${0.92 + p * 0.08})` }}>
      <div style={{ fontFamily: FONT_TH, fontWeight: 500, fontSize: size * 0.55, opacity: 0.85 }}>{label}</div>
      <div style={{ fontFamily: FONT_TH, fontWeight: 600, fontSize: size * 1.25, fontVariantNumeric: "tabular-nums" }}>{format(n)}</div>
    </div>
  );
}

export const baht = (n: number) => `฿${Math.round(n).toLocaleString("en-US")}`;

/** Soft cream backdrop with two faint ocean glows. */
export function Backdrop() {
  return <div style={{ position: "absolute", inset: 0, background: `radial-gradient(1200px 700px at 85% 10%, ${C.skySoft}, transparent 60%), radial-gradient(900px 600px at 0% 100%, #F4E7CF, transparent 60%), ${C.cream}` }} />;
}

export function fade(f: number, a: number, b: number, len = 12) {
  return interpolate(f, [a, a + len, b - len, b], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}
