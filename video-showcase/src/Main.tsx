// 60-second 16:9 cut (1920 × 1080, 30 fps). Captions on the left, the real interface on the right.
import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Backdrop, baht, box, BrowserFrame, C, camera, Caption, center, CountChip, Cursor, DemoBadge, fade, FONT_TH, Highlight, OUT, Shot, useFonts, Whale, Wordmark,
} from "./brand";
import { FeatureTag, InfoCard, LeadChip, ReconcileCard, Sfx } from "./parts";

// Layout
const FX = 760, FY = 84, FW = 1080, FH = 912; // browser frame
const VW = FW, VH = FH - 44; // visible app area
const CAP = { x: 96, y: 230, width: 660, size: 52 };
const TAG = { x: 96, y: 520 }; // feature tags sit in the caption column, never over the interface

function AppScene({ children, frameEnter = 0 }: { children: React.ReactNode; frameEnter?: number }) {
  return (
    <>
      <BrowserFrame x={FX} y={FY} w={FW} h={FH} enter={frameEnter}>{children}</BrowserFrame>
      <DemoBadge x={96} y={990} />
    </>
  );
}

function SceneFade({ len, children }: { len: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: fade(f, 0, len, 10) }}>{children}</AbsoluteFill>;
}

// ---------- 0–5 s: hook ----------
function Hook() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const w = spring({ frame: f, fps, config: { damping: 14, stiffness: 120 } });
  const reveal = interpolate(f, [24, 60], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  return (
    <SceneFade len={150}>
      <div style={{ position: "absolute", left: 96, top: 110, display: "flex", alignItems: "center", gap: 28 }}>
        <Whale size={150} style={{ transform: `scale(${w})` }} />
        <div style={{ opacity: interpolate(f, [8, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}><Wordmark size={64} /></div>
      </div>
      <Caption th={["จากข้อมูลกระจัดกระจาย", "สู่ระบบจัดการร้านกาแฟในที่เดียว"]} en="Balena Operations" start={14} end={150} x={96} y={360} width={700} size={50} />
      <div style={{ position: "absolute", left: 830, top: 150, width: 1000, height: 640, borderRadius: 28, overflow: "hidden", clipPath: `inset(0 ${100 - reveal}% 0 0 round 28px)`,
        boxShadow: "0 40px 90px rgba(10,31,77,.25)", transform: `translateY(${interpolate(f, [24, 60], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT })}px)` }}>
        <Shot scene="d_overview" rect={camera(f, [[24, { x: 300, y: 170, w: 1120 }], [150, { x: 20, y: 170, w: 980 }]])} width={1000} height={640} />
      </div>
      <DemoBadge x={830} y={815} />
    </SceneFade>
  );
}

// ---------- 5–12 s: the problem ----------
function Problem() {
  const f = useCurrentFrame();
  const fly = (i: number) => interpolate(f, [96 + i * 6, 140 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  const target = { x: 1180, y: 470 };
  const cards = [
    { icon: "cart", th: "ยอดขาย", en: "Sales", tone: C.ocean, x: 860, y: 170, rot: -6 },
    { icon: "receipt", th: "ต้นทุน", en: "Costs", tone: "#B5651D", x: 1400, y: 250, rot: 5 },
    { icon: "box", th: "สต็อก", en: "Stock", tone: C.teal, x: 1040, y: 640, rot: -3 },
  ];
  const win = interpolate(f, [120, 150], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  return (
    <SceneFade len={210}>
      <Caption th={["ยอดขาย ต้นทุน และสต็อก", "ต้องเห็นภาพเดียวกัน"]} en="One shared picture" start={6} end={210} {...CAP} />
      <div style={{ position: "absolute", left: 930, top: 300, width: 820, height: 520, borderRadius: 26, overflow: "hidden", opacity: win,
        transform: `scale(${0.85 + win * 0.15})`, boxShadow: "0 40px 90px rgba(10,31,77,.25)", background: "#fff" }}>
        <Shot scene="d_overview" rect={{ x: 20, y: 180, w: 1000 }} width={820} height={520} />
      </div>
      {cards.map((c, i) => {
        const p = fly(i);
        const float = Math.sin((f + i * 20) / 18) * 6 * (1 - p);
        const enter = interpolate(f, [i * 8, i * 8 + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
        return (
          <div key={c.th} style={{ position: "absolute", left: 0, top: 0, opacity: enter * (1 - interpolate(p, [0.75, 1], [0, 1], { extrapolateLeft: "clamp" })),
            transform: `translate(${(target.x - c.x) * p}px, ${(target.y - c.y) * p + float}px) scale(${1 - p * 0.55})` }}>
            <InfoCard {...c} rot={c.rot * (1 - p)} />
          </div>
        );
      })}
      {win > 0 && <DemoBadge x={930} y={840} />}
    </SceneFade>
  );
}

// ---------- 12–22 s: business overview ----------
function Overview() {
  const f = useCurrentFrame();
  const cards = (i: number) => box("d_overview", ".statband .dcard", i);
  const sales = cards(0), cash = cards(1), exp = cards(2), profit = cards(3);
  const rect = camera(f, [[0, { x: 0, y: 150, w: 1440 }], [60, { x: 0, y: 150, w: 1440 }], [100, { x: 20, y: 250, w: 720 }], [190, { x: 20, y: 250, w: 720 }],
    [222, { x: 696, y: 250, w: 720 }], [300, { x: 696, y: 250, w: 720 }]]);
  return (
    <SceneFade len={300}>
      <Caption th={["เห็นภาพรวมธุรกิจ", "เข้าใจง่ายในหน้าเดียว"]} en="Business overview" start={8} end={300} {...CAP} />
      <AppScene>
        <Shot scene="d_overview" rect={rect} width={VW} height={VH}>
          <Highlight b={sales} start={108} end={190} radius={20} />
          <Highlight b={cash} start={140} end={200} radius={20} />
          <Highlight b={exp} start={228} end={300} radius={20} />
          <Highlight b={profit} start={244} end={300} radius={20} color={C.amber} />
          <Cursor path={[[80, 1000, 700], [110, center(sales).x + 60, sales.y + 70], [160, center(cash).x + 40, cash.y + 70], [232, center(exp).x, exp.y + 70], [256, center(profit).x, profit.y + 80]]} />
        </Shot>
      </AppScene>
      <CountChip label="ยอดขาย · Sales" value={46520} format={baht} start={116} x={96} y={560} />
      <CountChip label="เงินเข้าจริง · Received" value={19630} format={baht} start={150} x={400} y={560} size={26} />
      <CountChip label="ค่าใช้จ่าย · Expenses" value={6240} format={baht} start={232} x={96} y={760} size={26} />
      <PendingChip start={252} x={380} y={760} />
    </SceneFade>
  );
}

function PendingChip({ start, x, y }: { start: number; x: number; y: number }) {
  const f = useCurrentFrame();
  const p = interpolate(f, [start, start + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  return (
    <div style={{ position: "absolute", left: x, top: y, padding: "14px 22px", borderRadius: 18, background: C.amberSoft, color: "#6B4C00", border: `2px solid ${C.amber}66`,
      opacity: p, transform: `translateY(${(1 - p) * 24}px)`, fontFamily: FONT_TH, boxShadow: "0 18px 40px rgba(10,31,77,.16)" }}>
      <div style={{ fontWeight: 500, fontSize: 16 }}>กำไร · Profit</div>
      <div style={{ fontWeight: 600, fontSize: 30 }}>รอต้นทุนครบ</div>
      <div style={{ fontWeight: 500, fontSize: 16 }}>Costs pending</div>
    </div>
  );
}

// ---------- 22–32 s: stock and production ----------
function Stock() {
  const f = useCurrentFrame();
  const sel = box("d_stock", ".filters select", 0);
  const filtered = interpolate(f, [52, 62], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const st = { x: 200, y: 214, w: 840 };
  const status = box("d_batch", ".facts div", 3), out = box("d_batch", "table.table tbody tr", 0), entry = box("d_batch", ".batch .docs li", 0);
  const done = box("d_batch", ".batch .btn--primary", 1);
  return (
    <SceneFade len={300}>
      <Caption th={["รู้ว่าสินค้าเหลือเท่าไร", "ผลิตและเติมสต็อกได้เป็นระบบ"]} en="Stock & production" start={8} end={300} {...CAP} size={48}
        sub="บันทึกสินค้าที่ผลิตได้ก่อน แล้วค่อยบันทึกวัตถุดิบที่ใช้" />
      <AppScene>
        <Sequence durationInFrames={100} layout="none">
          <Shot scene="d_stock" rect={st} width={VW} height={VH}>
            <Highlight b={box("d_stock", ".filters")} start={30} end={60} />
            <Cursor path={[[8, 900, 720], [40, center(sel).x, center(sel).y]]} clicks={[48]} />
          </Shot>
          <div style={{ position: "absolute", inset: 0, opacity: filtered }}>
            <Shot scene="d_stock_beans" rect={st} width={VW} height={VH}>
              {[0, 1, 2, 3, 4, 5].map((i) => <Highlight key={i} b={box("d_stock_beans", "table.table tbody tr", i)} start={66 + i * 3} end={100} pad={2} radius={8} />)}
            </Shot>
          </div>
        </Sequence>
        <Sequence from={100} durationInFrames={70} layout="none">
          <Shot scene="d_moves" rect={st} width={VW} height={VH}>
            {[0, 1, 2, 3, 4, 5].map((i) => <Highlight key={i} b={box("d_moves", "table.table tbody tr", i)} start={10 + i * 5} end={70} pad={2} radius={8} />)}
          </Shot>
        </Sequence>
        <Sequence from={170} durationInFrames={130} layout="none">
          <BatchShot status={status} out={out} entry={entry} done={done} />
        </Sequence>
      </AppScene>
      <FeatureTag text="Stock by category" start={10} end={100} x={TAG.x} y={TAG.y} />
      <FeatureTag text="Stock movements" start={100} end={170} x={TAG.x} y={TAG.y} />
      <FeatureTag text="Output-first production" start={172} end={300} x={TAG.x} y={TAG.y} />
    </SceneFade>
  );
}
function BatchShot({ status, out, entry, done }: { status: ReturnType<typeof box>; out: ReturnType<typeof box>; entry: ReturnType<typeof box>; done: ReturnType<typeof box> }) {
  const f = useCurrentFrame();
  const rect = camera(f, [[0, { x: 200, y: 214, w: 1040 }], [52, { x: 200, y: 214, w: 1040 }], [78, { x: 200, y: 570, w: 1040 }]]);
  return (
    <Shot scene="d_batch" rect={rect} width={VW} height={VH}>
      <Highlight b={out} start={8} end={60} pad={4} radius={10} />
      <Highlight b={status} start={18} end={60} color={C.amber} />
      <Highlight b={entry} start={78} end={130} />
      <Highlight b={done} start={104} end={130} wiggle />
      <Cursor path={[[60, 900, 700], [96, center(done).x, center(done).y]]} clicks={[104]} />
    </Shot>
  );
}

// ---------- 32–44 s: ICONSIAM ----------
function Iconsiam() {
  const f = useCurrentFrame();
  const kc = box("d_ics_stock", ".statband .kcard", 2), call = box("d_ics_stock", ".callouts li", 0);
  const vino = box("d_ics_stock", ".skus tbody tr", 0), whisky = box("d_ics_stock", ".skus tbody tr", 1);
  return (
    <SceneFade len={360}>
      <Caption th={["ติดตามยอดขาย ICONSIAM", "วางแผนเติมสินค้าล่วงหน้า"]} en="ICONSIAM tracking" start={8} end={360} {...CAP} />
      <AppScene>
        <Sequence durationInFrames={180} layout="none">
          <Shot scene="d_ics_stock" rect={camera(f, [[0, { x: 0, y: 280, w: 1440 }], [36, { x: 0, y: 280, w: 1440 }], [64, { x: 20, y: 510, w: 1000 }], [100, { x: 20, y: 510, w: 1000 }], [126, { x: 30, y: 930, w: 780 }]])} width={VW} height={VH}>
            <Highlight b={kc} start={66} end={110} color={C.red} radius={20} />
            <Highlight b={call} start={80} end={116} color={C.red} />
            <Highlight b={vino} start={132} end={180} color={C.red} pad={2} radius={10} />
            <Highlight b={whisky} start={142} end={180} color={C.red} pad={2} radius={10} />
          </Shot>
        </Sequence>
        <Sequence from={180} durationInFrames={120} layout="none">
          <DrawerShot />
        </Sequence>
        <Sequence from={300} durationInFrames={60} layout="none">
          <Shot scene="d_ship" rect={{ x: 0, y: 220, w: 1440 }} width={VW} height={VH}>
            <Highlight b={box("d_ship", ".shipsteps")} start={8} end={60} color={C.teal} />
          </Shot>
        </Sequence>
      </AppScene>
      <FeatureTag text="Current sales & stock" start={10} end={126} x={TAG.x} y={TAG.y} />
      <FeatureTag text="Replenishment alerts" start={126} end={180} x={TAG.x} y={TAG.y} />
      <FeatureTag text="Preparation timeline" start={182} end={300} x={TAG.x} y={TAG.y} />
      <FeatureTag text="Deliveries received" start={302} end={360} x={TAG.x} y={TAG.y} />
      <Sequence from={180} durationInFrames={120} layout="none"><LeadChip start={40} end={120} x={96} y={640} size={28} /></Sequence>
    </SceneFade>
  );
}
function DrawerShot() {
  const f = useCurrentFrame();
  return (
    <Shot scene="d_ics_drawer" rect={camera(f, [[0, { x: 600, y: 60, w: 860 }], [36, { x: 790, y: 410, w: 660 }]])} width={VW} height={VH}>
      <Highlight b={box("d_ics_drawer", ".drawer .tl")} start={40} end={120} />
      <Highlight b={box("d_ics_drawer", ".drawer .pstatus")} start={6} end={40} color={C.red} pad={4} />
    </Shot>
  );
}

// ---------- 44–53 s: reports ----------
function Reports() {
  const f = useCurrentFrame();
  const chip = (i: number) => box("d_ics_sales", ".chips button", i);
  const rect = camera(f, [[0, { x: 20, y: 440, w: 1100 }], [84, { x: 20, y: 440, w: 1100 }], [104, { x: 30, y: 1080, w: 1380 }], [164, { x: 30, y: 1080, w: 1380 }],
    [184, { x: 30, y: 2800, w: 860 }]]);
  return (
    <SceneFade len={270}>
      <Caption th={["เชื่อมยอดขายกับรายงาน", "ลดการนับข้อมูลซ้ำ"]} en="Reports" start={8} end={270} {...CAP} />
      <AppScene>
        <Shot scene="d_ics_sales" rect={rect} width={VW} height={VH}>
          <Highlight b={box("d_ics_sales", ".chips")} start={14} end={84} />
          <Cursor path={[[6, 900, 900], [28, center(chip(8)).x, center(chip(8)).y], [48, center(chip(9)).x, center(chip(9)).y]]} clicks={[34, 54]} />
          <Highlight b={box("d_ics_sales", ".mbars")} start={108} end={168} />
          <Highlight b={box("d_ics_sales", ".ibars")} start={120} end={168} />
          <Highlight b={box("d_ics_sales", ".src", 1)} start={192} end={270} color={C.amber} pad={2} radius={8} />
          <Highlight b={box("d_ics_sales", ".src", 2)} start={198} end={270} color={C.amber} pad={2} radius={8} />
          <Highlight b={box("d_ics_sales", ".src", 3)} start={214} end={270} color={C.teal} pad={2} radius={8} />
        </Shot>
      </AppScene>
      <FeatureTag text="Monthly filters" start={10} end={90} x={TAG.x} y={TAG.y} />
      <FeatureTag text="Product comparison" start={92} end={170} x={TAG.x} y={TAG.y} />
      <FeatureTag text="Provisional → final report" start={172} end={270} x={TAG.x} y={TAG.y} />
      <ReconcileCard start={186} end={270} x={96} y={610} scale={0.72} />
    </SceneFade>
  );
}

// ---------- 53–60 s: close ----------
function Close() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const w = spring({ frame: f - 6, fps, config: { damping: 15, stiffness: 110 } });
  const o = (a: number) => interpolate(f, [a, a + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  return (
    <AbsoluteFill style={{ opacity: interpolate(f, [0, 12], [0, 1], { extrapolateRight: "clamp" }) }}>
      <div style={{ position: "absolute", left: 980, top: 150, width: 860, height: 560, borderRadius: 28, overflow: "hidden", opacity: 0.9, boxShadow: "0 40px 90px rgba(10,31,77,.25)" }}>
        <Shot scene="d_overview" rect={camera(f, [[0, { x: 20, y: 270, w: 1000 }], [210, { x: 20, y: 270, w: 900 }]])} width={860} height={560} />
      </div>
      <DemoBadge x={980} y={735} />
      <div style={{ position: "absolute", left: 96, top: 130, display: "flex", alignItems: "center", gap: 26 }}>
        <Whale size={130} style={{ transform: `scale(${w})` }} />
        <div style={{ opacity: o(12) }}><Wordmark size={60} /></div>
      </div>
      <div style={{ position: "absolute", left: 96, top: 330, width: 820 }}>
        <div lang="th" style={{ fontFamily: FONT_TH, fontWeight: 600, fontSize: 58, lineHeight: 1.35, color: C.navy, opacity: o(18) }}>Balena Roastery</div>
        <div lang="th" style={{ fontFamily: FONT_TH, fontWeight: 600, fontSize: 58, lineHeight: 1.35, color: C.navy, opacity: o(26) }}>พัฒนาจากโจทย์ธุรกิจจริง</div>
        <div lang="th" style={{ fontFamily: "'Noto Sans Thai'", fontSize: 30, lineHeight: 1.7, color: C.muted, marginTop: 18, opacity: o(40) }}>ออกแบบระบบให้เหมาะกับวิธีทำงานของเรา</div>
        <div style={{ fontFamily: FONT_TH, fontWeight: 500, fontSize: 34, color: C.ocean, marginTop: 26, opacity: o(54) }}>Built around a real business.</div>
      </div>
      <div style={{ position: "absolute", left: 96, top: 930, fontFamily: FONT_TH, fontWeight: 500, fontSize: 26, color: C.oceanDeep, opacity: o(70) }}>balenaroastery.com</div>
    </AbsoluteFill>
  );
}

export const MAIN_FRAMES = 1800;
export function Main() {
  useFonts();
  const seq = [[0, 150, <Hook />], [150, 210, <Problem />], [360, 300, <Overview />], [660, 300, <Stock />], [960, 360, <Iconsiam />], [1320, 270, <Reports />], [1590, 210, <Close />]] as const;
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <Backdrop />
      {seq.map(([from, len, el]) => <Sequence key={from} from={from} durationInFrames={len}>{el}</Sequence>)}
      <Audio src={staticFile("audio/music-60.wav")} volume={0.55} />
      {[150, 360, 660, 960, 1320, 1590].map((at) => <Sfx key={at} at={at - 6} src="whoosh" volume={0.35} />)}
      {[708, 934, 1354, 1374].map((at) => <Sfx key={at} at={at} src="click" volume={0.6} />)}
      {[468, 500, 588, 604, 1026, 1092, 1102, 1180].map((at) => <Sfx key={at} at={at} src="pop" volume={0.28} />)}
      {[1542, 1610].map((at) => <Sfx key={at} at={at} src="chime" volume={0.35} />)}
    </AbsoluteFill>
  );
}
