import { useId, type CSSProperties } from "react";
import {
  ingredientById,
  liquidColors,
  type Ingredient,
  type LiquidKind,
  type Recipe,
} from "../config/recipes";
import {
  HEIGHT,
  PHASES,
  WIDTH,
  easeInOut,
  easeOut,
  lerp,
  phaseAt,
  progress,
} from "./timeline";

// Draws one frame of a recipe demonstration. Pure: the same frame always gives the
// same picture, so it works inside the Remotion Player and as a static image.

const C = {
  cream: "#FBF5EA",
  ocean: "#145A8C",
  coffee: "#5B3A24",
  sky: "#D6EAF6",
  ink: "#22303A",
  glass: "#8FBBD6",
};

// Glass geometry (composition pixels).
const GLASS = { top: 330, bottom: 722, topL: 196, topR: 464, botL: 220, botR: 440 };
const INNER_BOTTOM = 706;
const PX_PER_ML = (INNER_BOTTOM - 360) / 250; // the glass holds about 250 มล. to the brim
const GLASS_CX = (GLASS.topL + GLASS.topR) / 2;

const ICE_CUBES = [
  { x: 262, y: 626, r: -8, delay: 0 },
  { x: 338, y: 636, r: 10, delay: 6 },
  { x: 296, y: 566, r: 4, delay: 12 },
  { x: 366, y: 572, r: -12, delay: 18 },
];

const BUBBLES = Array.from({ length: 14 }, (_, i) => ({
  x: 236 + ((i * 53) % 190),
  speed: 2.2 + ((i * 7) % 5) * 0.5,
  offset: (i * 97) % 300,
  r: 3 + (i % 3),
}));

const font = "'Noto Sans Thai', sans-serif";

type Props = { recipe: Recipe; frame: number };

export function RecipeScene({ recipe, frame }: Props) {
  const uid = "s" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const phase = phaseAt(frame);
  const pours = recipe.pours.map((p) => ({ ...p, ing: ingredientById(recipe, p.ingredientId) }));

  // Fill progress of each pour: the stream runs in the middle of its phase.
  const fill = [PHASES.pour1, PHASES.pour2].map(([s]) => easeInOut(progress(frame, s + 16, s + 58)));
  const h1 = (pours[0].ing.ml ?? 0) * PX_PER_ML * fill[0];
  const h2 = (pours[1].ing.ml ?? 0) * PX_PER_ML * fill[1];
  const surface = INNER_BOTTOM - h1 - h2;
  const mixT = easeInOut(progress(frame, PHASES.mix[0] + 8, PHASES.mix[1] - 6));

  const glassIn = easeOut(progress(frame, 4, 24));

  return (
    <div style={{ position: "absolute", inset: 0, background: C.cream, fontFamily: font, overflow: "hidden" }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height="100%" style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        <defs>
          <clipPath id={`${uid}-inner`}>
            <polygon points={`${GLASS.topL + 8},${GLASS.top} ${GLASS.topR - 8},${GLASS.top} ${GLASS.botR - 6},${INNER_BOTTOM} ${GLASS.botL + 6},${INNER_BOTTOM}`} />
          </clipPath>
        </defs>

        {/* Table line and a soft light-blue disc behind the glass */}
        <circle cx={GLASS_CX} cy={540} r={250} fill={C.sky} opacity={0.55 * glassIn} />
        <line x1={60} x2={660} y1={GLASS.bottom} y2={GLASS.bottom} stroke={C.coffee} strokeOpacity={0.25} strokeWidth={3} />

        <g opacity={glassIn}>
          {/* Liquid layers, then the mixed colour fading over them */}
          <g clipPath={`url(#${uid}-inner)`}>
            <Layer kind={pours[0].ing.kind as LiquidKind} y={INNER_BOTTOM - h1} h={h1} />
            <Layer kind={pours[1].ing.kind as LiquidKind} y={surface} h={h2} />
            {mixT > 0 && (
              <rect x={150} width={360} y={surface} height={h1 + h2} fill={recipe.mixedColor} opacity={mixT} />
            )}
            {recipe.bubbles && frame > PHASES.pour2[0] + 20 && (
              <Bubbles frame={frame} surface={surface} />
            )}
            {h1 + h2 > 0 && (
              <rect x={150} width={360} y={surface} height={4} fill="#FFFFFF" opacity={0.35} />
            )}
          </g>

          <Ice frame={frame} />

          {/* Glass outline drawn last so it sits over liquid and ice */}
          <polygon
            points={`${GLASS.topL},${GLASS.top} ${GLASS.topR},${GLASS.top} ${GLASS.botR},${GLASS.bottom} ${GLASS.botL},${GLASS.bottom}`}
            fill="#FFFFFF"
            fillOpacity={0.12}
            stroke={C.glass}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <line x1={GLASS.botL + 4} x2={GLASS.botR - 4} y1={INNER_BOTTOM + 6} y2={INNER_BOTTOM + 6} stroke={C.glass} strokeWidth={4} />
          <line x1={GLASS.topL + 26} x2={GLASS.botL + 28} y1={GLASS.top + 30} y2={GLASS.bottom - 60} stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" opacity={0.7} />
        </g>

        <Stirrer frame={frame} />

        {pours.map((p, i) => (
          <Jug
            key={p.ingredientId}
            ing={p.ing}
            uid={uid}
            frame={frame}
            phase={i === 0 ? PHASES.pour1 : PHASES.pour2}
            surface={surface}
          />
        ))}
      </svg>

      <Header recipe={recipe} frame={frame} phase={phase} captions={pours.map((p) => p.caption)} />
      <Chips recipe={recipe} frame={frame} phase={phase} activeIds={pours.map((p) => p.ingredientId)} />
    </div>
  );
}

function Layer({ kind, y, h }: { kind: LiquidKind; y: number; h: number }) {
  if (h <= 0) return null;
  const clear = kind === "water" || kind === "soda";
  return <rect x={150} width={360} y={y} height={h} fill={liquidColors[kind]} opacity={clear ? 0.85 : 1} />;
}

function Ice({ frame }: { frame: number }) {
  const [start] = PHASES.ice;
  return (
    <g>
      {ICE_CUBES.map((c, i) => {
        const t = easeOut(progress(frame, start + c.delay, start + c.delay + 18));
        if (t <= 0) return null;
        const y = lerp(150, c.y, t);
        return (
          <g key={i} transform={`translate(${c.x} ${y}) rotate(${c.r})`}>
            <rect x={-28} y={-28} width={56} height={56} rx={10} fill="#FFFFFF" fillOpacity={0.6} stroke="#9CC9E3" strokeWidth={3} />
            <path d="M -16 -14 L 4 -14" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}

function Bubbles({ frame, surface }: { frame: number; surface: number }) {
  const depth = INNER_BOTTOM - surface;
  if (depth < 20) return null;
  return (
    <g>
      {BUBBLES.map((b, i) => {
        const y = INNER_BOTTOM - ((frame * b.speed + b.offset) % depth);
        return <circle key={i} cx={b.x} cy={y} r={b.r} fill="none" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={2} />;
      })}
    </g>
  );
}

function Stirrer({ frame }: { frame: number }) {
  const [s, e] = PHASES.mix;
  const appear = progress(frame, s, s + 8) * (1 - progress(frame, e - 8, e));
  if (appear <= 0) return null;
  const swing = Math.sin(((frame - s) / 30) * Math.PI * 2.2) * 34;
  const x = GLASS_CX + swing;
  return (
    <g opacity={appear}>
      <line x1={x + swing * 0.4} y1={270} x2={x} y2={660} stroke={C.ocean} strokeWidth={9} strokeLinecap="round" />
      <ellipse cx={x} cy={668} rx={14} ry={8} fill={C.ocean} />
    </g>
  );
}

/** A plain measuring jug with a printed amount. The product pouch itself is never drawn. */
function Jug({ ing, uid, frame, phase, surface }: { ing: Ingredient; uid: string; frame: number; phase: readonly [number, number]; surface: number }) {
  const [s, e] = phase;
  if (frame < s || frame >= e) return null;
  const inT = easeOut(progress(frame, s, s + 14));
  const outT = easeInOut(progress(frame, e - 14, e));
  const tilt = easeInOut(progress(frame, s + 8, s + 18)) * (1 - easeInOut(progress(frame, s + 58, s + 66)));
  const remaining = 1 - easeInOut(progress(frame, s + 16, s + 58));

  // The spout tip is the jug's pivot.
  const spoutX = lerp(lerp(780, 360, inT), 780, outT);
  const spoutY = 300;
  const angle = -62 * tilt;
  const color = liquidColors[ing.kind as LiquidKind];
  const streaming = frame >= s + 16 && frame < s + 58;
  const streamW = ing.kind === "coldbrew" ? 9 : 12;

  return (
    <g>
      {streaming && (
        <rect x={spoutX - streamW / 2} y={spoutY} width={streamW} height={Math.max(0, surface - spoutY)} rx={streamW / 2} fill={color} stroke={ing.kind === "coldbrew" || ing.kind === "orange" ? "none" : C.glass} strokeWidth={2} />
      )}
      <g transform={`translate(${spoutX} ${spoutY}) rotate(${angle}) scale(0.8)`}>
        {/* body */}
        <clipPath id={`${uid}-jug-${ing.id}`}>
          <path d="M 0 0 L 22 6 L 22 150 Q 22 162 34 162 L 128 162 Q 140 162 140 150 L 140 6 Z" />
        </clipPath>
        <g clipPath={`url(#${uid}-jug-${ing.id})`}>
          <rect x={0} y={0} width={150} height={170} fill="#FFFFFF" fillOpacity={0.75} />
          <rect x={0} y={162 - 120 * remaining} width={150} height={170} fill={color} opacity={ing.kind === "water" || ing.kind === "soda" ? 0.85 : 1} />
        </g>
        <path d="M 0 0 L 22 6 L 22 150 Q 22 162 34 162 L 128 162 Q 140 162 140 150 L 140 6 Z" fill="none" stroke={C.glass} strokeWidth={5} strokeLinejoin="round" />
        <path d="M 140 40 Q 182 44 180 86 Q 178 124 140 126" fill="none" stroke={C.glass} strokeWidth={9} strokeLinecap="round" />
        {[60, 90, 120].map((y) => (
          <line key={y} x1={110} x2={132} y1={y} y2={y} stroke={C.ocean} strokeWidth={3} />
        ))}
      </g>
    </g>
  );
}

function shortName(ing: Ingredient): string {
  if (ing.kind === "coldbrew") return "Cold Brew";
  if (ing.kind === "milk") return "นม";
  return ing.name;
}

function Header({ recipe, frame, phase, captions }: { recipe: Recipe; frame: number; phase: ReturnType<typeof phaseAt>; captions: string[] }) {
  const captionFor: Record<string, string> = {
    intro: "เตรียมส่วนผสม",
    ice: "ใส่น้ำแข็ง",
    pour1: captions[0],
    pour2: captions[1],
    mix: recipe.mixCaption,
    done: "พร้อมดื่ม",
    end: "ปรับความเข้มได้ตามชอบ",
  };
  const [ps] = PHASES[phase];
  const t = easeOut(progress(frame, ps, ps + 10));
  const titleT = easeOut(progress(frame, 0, 14));
  const isEnd = phase === "end";

  const title: CSSProperties = {
    margin: 0,
    fontSize: isEnd ? 64 : 52,
    fontWeight: 700,
    color: C.coffee,
    lineHeight: 1.35,
    opacity: titleT,
    transform: `translateY(${(1 - titleT) * 14}px)`,
  };
  const caption: CSSProperties = {
    marginTop: 8,
    fontSize: 40,
    fontWeight: 600,
    color: C.ocean,
    lineHeight: 1.5,
    opacity: t,
    transform: `translateY(${(1 - t) * 12}px)`,
  };

  return (
    <div style={{ position: "absolute", left: 40, right: 40, top: isEnd ? 60 : 36, textAlign: "left" }}>
      <p style={title}>{recipe.name}</p>
      <p style={{ ...caption, marginBottom: 0 }}>{captionFor[phase]}</p>
    </div>
  );
}

function Chips({ recipe, frame, phase, activeIds }: { recipe: Recipe; frame: number; phase: ReturnType<typeof phaseAt>; activeIds: string[] }) {
  const active =
    phase === "ice" ? "ice" : phase === "pour1" ? activeIds[0] : phase === "pour2" ? activeIds[1] : null;
  const fadeOut = 1 - progress(frame, PHASES.end[0], PHASES.end[0] + 10);
  const doneUntil: Record<string, number> = {
    ice: PHASES.ice[1],
    [activeIds[0]]: PHASES.pour1[1],
    [activeIds[1]]: PHASES.pour2[1],
  };

  return (
    <ul style={{ position: "absolute", left: 24, right: 24, top: 744, margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 10, opacity: fadeOut }}>
      {recipe.ingredients.map((ing, i) => {
        const t = easeOut(progress(frame, 8 + i * 8, 22 + i * 8));
        const isActive = ing.id === active;
        const isDone = doneUntil[ing.id] !== undefined && frame >= doneUntil[ing.id];
        return (
          <li
            key={ing.id}
            style={{
              fontSize: 32,
              lineHeight: 1.35,
              fontWeight: isActive ? 700 : 500,
              padding: "6px 16px",
              borderRadius: 999,
              border: `3px solid ${isActive ? C.ocean : "#E2D6C2"}`,
              background: isActive ? C.ocean : "#FFFFFF",
              color: isActive ? "#FFFFFF" : ing.optional ? "#6B6259" : C.ink,
              opacity: t,
              transform: `translateY(${(1 - t) * 10}px)`,
            }}
          >
            {isDone ? "✓ " : ""}
            {ing.optional ? `${ing.name} ไม่ใส่ก็ได้` : `${shortName(ing)} ${ing.amount}`}
          </li>
        );
      })}
    </ul>
  );
}
