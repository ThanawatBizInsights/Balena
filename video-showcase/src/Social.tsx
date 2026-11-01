// 30-second 9:16 cut (1080 × 1920, 30 fps), recomposed for phones: the app's mobile layout in a
// phone frame, captions at the top. Essential text stays between y ≈ 200 and 1500 (clear of the
// platform's header, caption bar and side buttons).
import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, box, C, camera, Caption, center, Cursor, DemoBadge, fade, FONT_TH, Highlight, OUT, PhoneFrame, Shot, useFonts, Whale, Wordmark } from "./brand";
import { FeatureTag, InfoCard, LeadChip, ReconcileCard, Sfx } from "./parts";

const PX = 150, PY = 640, PW = 780, PH = 1060; // phone screen
const CAP = { x: 80, y: 220, width: 920, size: 62 };

function Phone({ children, enter = 0 }: { children: React.ReactNode; enter?: number }) {
  return (
    <>
      <PhoneFrame x={PX} y={PY} w={PW} h={PH} enter={enter}>{children}</PhoneFrame>
      <DemoBadge x={PX} y={PY - 74} size={24} />
    </>
  );
}
function Fade({ len, children }: { len: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: fade(f, 0, len, 8) }}>{children}</AbsoluteFill>;
}
// Feature tags sit on the row above the phone (right of the demo badge), never over the screen.
const tag = (text: string, start: number, end: number) => <FeatureTag text={text} start={start} end={end} x={PX + 420} y={PY - 86} size={26} />;

function Hook() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const w = spring({ frame: f, fps, config: { damping: 14, stiffness: 120 } });
  const up = interpolate(f, [18, 50], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  return (
    <Fade len={90}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <Whale size={220} style={{ transform: `scale(${w})` }} />
        <div style={{ opacity: interpolate(f, [8, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}><Wordmark size={70} /></div>
      </div>
      <Caption th={["จากข้อมูลกระจัดกระจาย", "สู่ระบบจัดการร้านกาแฟในที่เดียว"]} en="Balena Operations" start={10} end={90} x={60} y={640} width={960} size={60} align="center" />
      <div style={{ position: "absolute", left: 90, top: 1030, width: 900, height: 460, borderRadius: 32, overflow: "hidden", boxShadow: "0 40px 90px rgba(10,31,77,.25)",
        transform: `translateY(${up * 260}px)`, opacity: 1 - up }}>
        <Shot scene="m_overview" rect={{ x: 10, y: 498, w: 370 }} width={900} height={460} />
      </div>
      <div style={{ opacity: 1 - up }}><DemoBadge x={90} y={1515} size={24} /></div>
    </Fade>
  );
}

function Problem() {
  const f = useCurrentFrame();
  const target = { x: 400, y: 1100 };
  const cards = [
    { icon: "cart", th: "ยอดขาย", en: "Sales", tone: C.ocean, x: 90, y: 680, rot: -6 },
    { icon: "receipt", th: "ต้นทุน", en: "Costs", tone: "#B5651D", x: 560, y: 860, rot: 5 },
    { icon: "box", th: "สต็อก", en: "Stock", tone: C.teal, x: 180, y: 1120, rot: -3 },
  ];
  const win = interpolate(f, [44, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  return (
    <Fade len={90}>
      <Caption th={["ยอดขาย ต้นทุน และสต็อก", "ต้องเห็นภาพเดียวกัน"]} en="One shared picture" start={4} end={90} {...CAP} />
      <div style={{ position: "absolute", left: 140, top: 820, width: 800, height: 600, borderRadius: 32, overflow: "hidden", opacity: win, transform: `scale(${0.85 + win * 0.15})`,
        boxShadow: "0 40px 90px rgba(10,31,77,.25)" }}>
        <Shot scene="m_overview" rect={{ x: 10, y: 498, w: 370 }} width={800} height={600} />
      </div>
      {cards.map((c, i) => {
        const p = interpolate(f, [30 + i * 4, 62 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
        const enter = interpolate(f, [i * 5, i * 5 + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
        return (
          <div key={c.th} style={{ position: "absolute", left: 0, top: 0, opacity: enter * (1 - interpolate(p, [0.75, 1], [0, 1], { extrapolateLeft: "clamp" })),
            transform: `translate(${(target.x - c.x) * p}px, ${(target.y - c.y) * p}px) scale(${1 - p * 0.5})` }}>
            <InfoCard {...c} rot={c.rot * (1 - p)} scale={1.05} />
          </div>
        );
      })}
      {win > 0 && <DemoBadge x={140} y={1440} size={24} />}
    </Fade>
  );
}

function Overview() {
  const f = useCurrentFrame();
  const card = (i: number) => box("m_overview", ".statband .dcard", i);
  const rect = camera(f, [[0, { x: 0, y: 230, w: 390 }], [36, { x: 0, y: 230, w: 390 }], [64, { x: 0, y: 492, w: 390 }], [104, { x: 0, y: 492, w: 390 }], [130, { x: 0, y: 760, w: 390 }]]);
  return (
    <Fade len={180}>
      <Caption th={["เห็นภาพรวมธุรกิจ", "เข้าใจง่ายในหน้าเดียว"]} en="Business overview" start={6} end={180} {...CAP} />
      <Phone>
        <Shot scene="m_overview" rect={rect} width={PW} height={PH}>
          <Highlight b={card(0)} start={66} end={110} radius={20} />
          <Highlight b={card(1)} start={80} end={116} radius={20} />
          <Highlight b={card(2)} start={132} end={180} radius={20} />
          <Highlight b={card(3)} start={140} end={180} radius={20} color={C.amber} />
        </Shot>
      </Phone>
      {tag("Sales · receipts · expenses", 60, 128)}
      {tag("Costs pending", 132, 180)}
    </Fade>
  );
}

function Stock() {
  const f = useCurrentFrame();
  const done = box("m_batch", ".batch .btn--primary", 1);
  return (
    <Fade len={150}>
      <Caption th={["รู้ว่าสินค้าเหลือเท่าไร", "ผลิตและเติมสต็อกได้เป็นระบบ"]} en="Stock & production" start={6} end={150} {...CAP} size={58} />
      <Phone>
        <Sequence durationInFrames={56} layout="none">
          <Shot scene="m_stock_beans" rect={{ x: 0, y: 280, w: 390 }} width={PW} height={PH}>
            <Highlight b={box("m_stock_beans", ".filters")} start={6} end={34} />
            {[0, 1].map((i) => <Highlight key={i} b={box("m_stock_beans", "table.table tbody tr", i)} start={30 + i * 6} end={56} pad={2} radius={10} />)}
          </Shot>
        </Sequence>
        <Sequence from={56} durationInFrames={94} layout="none">
          <BatchPhone done={done} />
        </Sequence>
      </Phone>
      {tag("Stock by category", 4, 56)}
      {tag("Output-first production", 58, 150)}
    </Fade>
  );
}
function BatchPhone({ done }: { done: ReturnType<typeof box> }) {
  const f = useCurrentFrame();
  const rect = camera(f, [[0, { x: 0, y: 330, w: 390 }], [30, { x: 0, y: 330, w: 390 }], [56, { x: 0, y: 1470, w: 390 }]]);
  return (
    <Shot scene="m_batch" rect={rect} width={PW} height={PH}>
      <Highlight b={box("m_batch", ".facts")} start={6} end={34} color={C.amber} />
      <Highlight b={done} start={74} end={94} wiggle />
      <Cursor path={[[50, 300, 1650], [70, center(done).x, center(done).y]]} clicks={[74]} />
    </Shot>
  );
}

function Iconsiam() {
  return (
    <Fade len={180}>
      <Caption th={["ติดตามยอดขาย ICONSIAM", "วางแผนเติมสินค้าล่วงหน้า"]} en="ICONSIAM tracking" start={6} end={180} {...CAP} size={58} />
      <Phone>
        <Sequence durationInFrames={92} layout="none"><IcsPhone /></Sequence>
        <Sequence from={92} durationInFrames={88} layout="none"><DrawerPhone /></Sequence>
      </Phone>
      {tag("Replenishment alerts", 4, 92)}
      {tag("Preparation timeline", 94, 180)}
      <Sequence from={92} durationInFrames={88} layout="none"><LeadChip start={30} end={88} x={190} y={700} size={30} /></Sequence>
    </Fade>
  );
}
function IcsPhone() {
  const f = useCurrentFrame();
  const rect = camera(f, [[0, { x: 0, y: 975, w: 390 }], [34, { x: 0, y: 975, w: 390 }], [58, { x: 0, y: 1840, w: 390 }]]);
  return (
    <Shot scene="m_ics_stock" rect={rect} width={PW} height={PH}>
      <Highlight b={box("m_ics_stock", ".statband .kcard", 2)} start={8} end={36} color={C.red} radius={20} />
      <Highlight b={box("m_ics_stock", ".skus tbody tr", 0)} start={62} end={92} color={C.red} radius={14} />
    </Shot>
  );
}
function DrawerPhone() {
  const f = useCurrentFrame();
  return (
    <Shot scene="m_ics_drawer" rect={camera(f, [[0, { x: 0, y: 120, w: 390 }], [26, { x: 0, y: 330, w: 390 }]])} width={PW} height={PH}>
      <Highlight b={box("m_ics_drawer", ".drawer .tl")} start={28} end={88} />
    </Shot>
  );
}

function Reports() {
  const f = useCurrentFrame();
  const rect = camera(f, [[0, { x: 0, y: 830, w: 390 }], [36, { x: 0, y: 830, w: 390 }], [56, { x: 0, y: 2400, w: 390 }], [78, { x: 0, y: 2400, w: 390 }], [96, { x: 0, y: 7050, w: 390 }]]);
  return (
    <Fade len={120}>
      <Caption th={["เชื่อมยอดขายกับรายงาน", "ลดการนับข้อมูลซ้ำ"]} en="Reports" start={6} end={120} {...CAP} />
      <Phone>
        <Shot scene="m_ics_sales" rect={rect} width={PW} height={PH}>
          <Highlight b={box("m_ics_sales", ".chips")} start={8} end={36} />
          <Highlight b={box("m_ics_sales", ".mbars")} start={58} end={80} />
          <Highlight b={box("m_ics_sales", ".src", 1)} start={98} end={120} color={C.amber} pad={2} radius={10} />
          <Highlight b={box("m_ics_sales", ".src", 3)} start={102} end={120} color={C.teal} pad={2} radius={10} />
        </Shot>
      </Phone>
      {tag("Monthly filters", 4, 52)}
      {tag("Provisional → final report", 90, 120)}
      <ReconcileCard start={70} end={120} x={250} y={1000} scale={1.0} />
    </Fade>
  );
}

function Close() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const w = spring({ frame: f - 4, fps, config: { damping: 15, stiffness: 110 } });
  const o = (a: number) => interpolate(f, [a, a + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });
  return (
    <AbsoluteFill style={{ opacity: interpolate(f, [0, 10], [0, 1], { extrapolateRight: "clamp" }), alignItems: "center" }}>
      <div style={{ position: "absolute", top: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <Whale size={240} style={{ transform: `scale(${w})` }} />
        <div style={{ opacity: o(8) }}><Wordmark size={74} /></div>
      </div>
      <div style={{ position: "absolute", top: 760, width: 940, textAlign: "center" }}>
        <div lang="th" style={{ fontFamily: FONT_TH, fontWeight: 600, fontSize: 64, lineHeight: 1.35, color: C.navy, opacity: o(14) }}>Balena Roastery</div>
        <div lang="th" style={{ fontFamily: FONT_TH, fontWeight: 600, fontSize: 64, lineHeight: 1.35, color: C.navy, opacity: o(20) }}>พัฒนาจากโจทย์ธุรกิจจริง</div>
        <div lang="th" style={{ fontFamily: "'Noto Sans Thai'", fontSize: 36, lineHeight: 1.7, color: C.muted, marginTop: 20, opacity: o(32) }}>ออกแบบระบบให้เหมาะกับวิธีทำงานของเรา</div>
        <div style={{ fontFamily: FONT_TH, fontWeight: 500, fontSize: 40, color: C.ocean, marginTop: 30, opacity: o(42) }}>Built around a real business.</div>
        <div style={{ fontFamily: FONT_TH, fontWeight: 500, fontSize: 32, color: C.oceanDeep, marginTop: 60, opacity: o(54) }}>balenaroastery.com</div>
      </div>
    </AbsoluteFill>
  );
}

export const SOCIAL_FRAMES = 900;
export function Social() {
  useFonts();
  const seq = [[0, 90, <Hook />], [90, 90, <Problem />], [180, 180, <Overview />], [360, 150, <Stock />], [510, 180, <Iconsiam />], [690, 120, <Reports />], [810, 90, <Close />]] as const;
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <Backdrop />
      {seq.map(([from, len, el]) => <Sequence key={from} from={from} durationInFrames={len}>{el}</Sequence>)}
      <Audio src={staticFile("audio/music-30.wav")} volume={0.55} />
      {[90, 180, 360, 510, 690, 810].map((at) => <Sfx key={at} at={at - 5} src="whoosh" volume={0.35} />)}
      {[490].map((at) => <Sfx key={at} at={at} src="click" volume={0.6} />)}
      {[246, 312, 518, 632].map((at) => <Sfx key={at} at={at} src="pop" volume={0.28} />)}
      {[760, 824].map((at) => <Sfx key={at} at={at} src="chime" volume={0.35} />)}
    </AbsoluteFill>
  );
}
