// Scene parts shared by the 16:9 and 9:16 cuts: outline icons, the "problem" cards, feature tags,
// the provisional → final explainer and the sound cues.
import type { ReactNode } from "react";
import { Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT_BODY, FONT_TH, OUT } from "./brand";

const PATHS: Record<string, ReactNode> = {
  cart: <path d="M3 4h2l2.4 10.2a1.5 1.5 0 0 0 1.5 1.1h8.3a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2M9.5 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01" />,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h3" />,
  box: <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3zM3 7.5 12 12l9-4.5M12 12v9" />,
  check: <path d="M4 12l5 5L20 6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  truck: <><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></>,
};
export function Icon({ name, size = 28, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{PATHS[name]}</svg>
  );
}

/** One of the three scattered information cards (no real documents, just abstract rows). */
export function InfoCard({ icon, th, en, tone, x, y, rot, scale = 1 }: { icon: string; th: string; en: string; tone: string; x: number; y: number; rot: number; scale?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 330 * scale, padding: 26 * scale, borderRadius: 26 * scale, background: "#fff",
      boxShadow: "0 24px 60px rgba(10,31,77,.18)", transform: `rotate(${rot}deg)`, border: "1px solid rgba(10,31,77,.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 * scale }}>
        <span style={{ width: 54 * scale, height: 54 * scale, borderRadius: 99, background: tone, display: "grid", placeItems: "center", color: "#fff" }}>
          <Icon name={icon} size={28 * scale} />
        </span>
        <div>
          <div lang="th" style={{ fontFamily: FONT_TH, fontWeight: 600, fontSize: 30 * scale, color: C.navy, lineHeight: 1.2 }}>{th}</div>
          <div style={{ fontFamily: FONT_TH, fontWeight: 500, fontSize: 18 * scale, color: C.muted }}>{en}</div>
        </div>
      </div>
      {[0.9, 0.7, 0.8].map((w, i) => (
        <div key={i} style={{ marginTop: 16 * scale, height: 12 * scale, width: `${w * 100}%`, borderRadius: 6, background: i === 0 ? `${tone}55` : "#EFE7DA" }} />
      ))}
    </div>
  );
}

export function FeatureTag({ text, start, end, x, y, size = 24 }: { text: string; start: number; end: number; x: number; y: number; size?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: f - start, fps, config: { damping: 18, stiffness: 160 } });
  const o = interpolate(f, [start, start + 6, end - 8, end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: o, transform: `translateY(${(1 - sp) * 16}px)`, display: "flex", alignItems: "center", gap: 10,
      padding: `${size * 0.4}px ${size * 0.8}px`, borderRadius: 999, background: "#fff", color: C.oceanDeep, border: `2px solid ${C.sky}`,
      fontFamily: FONT_TH, fontWeight: 500, fontSize: size, boxShadow: "0 10px 30px rgba(10,31,77,.14)", whiteSpace: "nowrap" }}>
      <span style={{ width: size * 0.42, height: size * 0.42, borderRadius: 99, background: C.ocean }} />{text}
    </div>
  );
}

/** Callout used for the 4-day preparation lead time. */
export function LeadChip({ start, end, x, y, size = 30 }: { start: number; end: number; x: number; y: number; size?: number }) {
  const f = useCurrentFrame();
  const p = interpolate(f, [start, start + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  const o = interpolate(f, [end - 10, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: p * o, transform: `translateY(${(1 - p) * 24}px)`, padding: `${size * 0.55}px ${size * 0.85}px`,
      borderRadius: size * 0.7, background: C.navy, color: "#fff", boxShadow: "0 24px 60px rgba(10,31,77,.3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: size * 0.4 }}>
        <span style={{ width: size * 1.6, height: size * 1.6, borderRadius: 99, background: "linear-gradient(135deg,#0F7A68,#1D7BBF)", display: "grid", placeItems: "center" }}>
          <Icon name="truck" size={size} />
        </span>
        <div>
          <div lang="th" style={{ fontFamily: FONT_TH, fontWeight: 600, fontSize: size * 1.05, lineHeight: 1.3 }}>เตรียมสินค้าล่วงหน้า 4 วัน</div>
          <div style={{ fontFamily: FONT_TH, fontWeight: 500, fontSize: size * 0.62, opacity: 0.85 }}>4-day preparation lead time</div>
        </div>
      </div>
    </div>
  );
}

/** Provisional figures are replaced by the official report, never added to it (demo numbers from the scene). */
export function ReconcileCard({ start, end, x, y, scale = 1 }: { start: number; end: number; x: number; y: number; scale?: number }) {
  const f = useCurrentFrame();
  const a = interpolate(f, [start, start + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  const strike = interpolate(f, [start + 26, start + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  const b = interpolate(f, [start + 36, start + 52], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  const o = interpolate(f, [start, start + 8, end - 10, end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s = scale;
  const pill = (bg: string, fg: string, children: ReactNode, op: number, dy: number) => (
    <div style={{ padding: `${16 * s}px ${22 * s}px`, borderRadius: 20 * s, background: bg, color: fg, opacity: op, transform: `translateY(${dy}px)` }}>{children}</div>
  );
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 560 * s, padding: 26 * s, borderRadius: 28 * s, background: "#fff", opacity: o,
      boxShadow: "0 30px 70px rgba(10,31,77,.25)", display: "grid", gap: 14 * s, fontFamily: FONT_TH }}>
      <div style={{ fontWeight: 500, fontSize: 20 * s, color: C.muted }}>กันยายน · September</div>
      {pill(C.amberSoft, "#6B4C00", (
        <div style={{ position: "relative" }}>
          <div style={{ fontWeight: 500, fontSize: 20 * s }}>ยอดระหว่างเดือน · Provisional</div>
          <div style={{ fontWeight: 600, fontSize: 40 * s }}>87 ชิ้น</div>
          <div style={{ position: "absolute", left: 0, top: "62%", height: 4 * s, width: `${strike * 42}%`, background: C.red, borderRadius: 2 }} />
        </div>
      ), a, (1 - a) * 20)}
      <div style={{ display: "flex", alignItems: "center", gap: 10 * s, color: C.ocean, opacity: b, fontWeight: 500, fontSize: 22 * s }}>
        <Icon name="arrow" size={28 * s} /> แทนที่ด้วยรายงานทางการ · Replaced
      </div>
      {pill(C.navy, "#fff", (
        <div>
          <div style={{ fontWeight: 500, fontSize: 20 * s, opacity: 0.85 }}>รายงานทางการ · Final report</div>
          <div style={{ fontWeight: 600, fontSize: 40 * s }}>103 ชิ้น <span style={{ fontSize: 26 * s }}>✓</span></div>
        </div>
      ), b, (1 - b) * 20)}
      <div lang="th" style={{ fontFamily: FONT_BODY, fontSize: 21 * s, color: C.muted, opacity: b }}>นับ 103 ชิ้น ไม่ใช่ 87 + 103</div>
    </div>
  );
}

/** One-shot sound at a frame. */
export function Sfx({ at, src, volume = 0.5 }: { at: number; src: "click" | "pop" | "whoosh" | "chime"; volume?: number }) {
  return (
    <Sequence from={at} durationInFrames={45} layout="none">
      <Audio src={staticFile(`audio/${src}.wav`)} volume={volume} />
    </Sequence>
  );
}
