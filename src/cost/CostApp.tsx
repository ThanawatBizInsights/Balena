import { useEffect, useMemo, useState } from "react";
import { calculate, itemCost, type CostItem, type Inputs, type Result, type SegmentId, type Unit } from "./calc";
import { COFFEE_NAME, YOURS, defaults } from "./defaults";

const STORAGE_KEY = "balena-cost-calculator-v1";

const SEGMENTS: { id: SegmentId; name: string; color: string }[] = [
  { id: "coffee", name: "เมล็ดกาแฟ", color: "#8a4a1c" },
  { id: "brewing", name: "การชง (น้ำ กรอง ล้าง แรงงาน)", color: "#2a78d6" },
  { id: "packaging", name: "บรรจุภัณฑ์", color: "#eda100" },
  { id: "selling", name: "ส่งและค่าธรรมเนียม", color: "#e87ba4" },
  { id: "fixed", name: "ค่าใช้จ่ายรายเดือน", color: "#6250d6" },
  { id: "waste", name: "เผื่อเสียและแจกชิม", color: "#eb6834" },
];
const PROFIT_COLOR = "#1baf7a";

const UNIT_GROUPS: { unit: Unit; title: string; hint: string }[] = [
  { unit: "batch", title: "ต่อรอบการชง", hint: "หารด้วยจำนวนถุงที่ได้ต่อรอบ" },
  { unit: "pouch", title: "ต่อถุง", hint: "ทุกถุงที่บรรจุ" },
  { unit: "order", title: "ต่อออเดอร์", hint: "หารด้วยจำนวนถุงต่อออเดอร์" },
  { unit: "month", title: "ต่อเดือน", hint: "หารด้วยจำนวนถุงที่ขายได้ต่อเดือน" },
];

export function CostApp() {
  const [inputs, setInputs] = useState<Inputs>(loadInputs);
  const result = useMemo(() => calculate(inputs), [inputs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {
      // Private mode or storage blocked: the page still works, values just aren't kept.
    }
  }, [inputs]);

  const set = <K extends keyof Inputs>(key: K, value: Inputs[K]) => setInputs((s) => ({ ...s, [key]: value }));
  const setItem = (id: string, patch: Partial<CostItem>) =>
    setInputs((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const reset = () => setInputs(structuredClone(defaults));

  return (
    <>
      <header className="topbar">
        <span className="topbar__brand">Balena Roastery</span>
        <span className="topbar__tag">สำหรับทีมงาน</span>
      </header>
      <main className="cost">
        <section className="cost-intro">
          <h1 className="cost-title">ต้นทุนจริงของ Cold{"\u00A0"}Brew Original</h1>
          <p className="cost-lead">
            ใส่ตัวเลขของคุณ แล้วดูทันทีว่าแต่ละถุงต้นทุนเท่าไร กำไรเท่าไร และต้องขายกี่ถุงถึงคุ้ม
          </p>
          <p className="cost-small">
            ตัวเลขที่มีป้าย <Badge source="yours" /> มาจากคุณ ส่วนป้าย <Badge source="estimate" /> เป็นค่าตั้งต้น
            ให้แก้เป็นราคาจริง ทุกอย่างที่พิมพ์เก็บไว้ในเบราว์เซอร์นี้เท่านั้น
          </p>
        </section>

        <ResultPanel inputs={inputs} result={result} onPrice={(v) => set("price", v)} />
        <BatchSection inputs={inputs} result={result} set={set} />
        <HiddenCosts inputs={inputs} result={result} setItem={setItem} set={set} />
        <SalesSection inputs={inputs} result={result} set={set} />
        <Checklist />

        <div className="cost-reset">
          <button type="button" className="btn btn--outline" onClick={reset}>
            กลับไปใช้ค่าตั้งต้น
          </button>
        </div>
      </main>
      <StickySummary result={result} price={inputs.price} />
    </>
  );
}

/* ---------- headline: the pouch filled with its costs ---------- */

function ResultPanel({ inputs, result, onPrice }: { inputs: Inputs; result: Result; onPrice: (v: number) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const losing = result.profitPerPouch < 0;
  const rows = [
    ...SEGMENTS.map((s) => ({ ...s, value: result.segments[s.id] })),
    ...(losing ? [] : [{ id: "profit", name: "กำไร", color: PROFIT_COLOR, value: result.profitPerPouch }]),
  ];

  return (
    <section className="cost-card result" aria-labelledby="result-title">
      <h2 id="result-title" className="cost-h2">1 ถุง 500 มล. ประกอบด้วยอะไร</h2>
      <div className="result__grid">
        <PouchChart result={result} price={inputs.price} hover={hover} setHover={setHover} />
        <div>
          <div className="result__numbers">
            <Stat label="ต้นทุนต่อถุง" value={baht(result.costPerPouch)} />
            <div className="stat">
              <label className="stat__label" htmlFor="price-top">ราคาขายต่อถุง</label>
              <MoneyInput id="price-top" value={inputs.price} onChange={onPrice} />
            </div>
            <Stat
              label={losing ? "ขาดทุนต่อถุง" : "กำไรต่อถุง"}
              value={baht(Math.abs(result.profitPerPouch))}
              note={inputs.price > 0 ? `${pct(result.margin)} ของราคาขาย` : undefined}
              tone={losing ? "loss" : "profit"}
            />
          </div>
          <ul className="legend" aria-label="ต้นทุนแยกตามหมวด ต่อถุงที่ขายได้">
            {rows.map((r) => (
              <li
                key={r.id}
                className={hover && hover !== r.id ? "is-dim" : undefined}
                onMouseEnter={() => setHover(r.id)}
                onMouseLeave={() => setHover(null)}
              >
                <span className="legend__swatch" style={{ background: r.color }} aria-hidden="true" />
                <span className="legend__name">{r.name}</span>
                <span className="legend__value">{baht(r.value)}</span>
                <span className="legend__share">{inputs.price > 0 ? pct(r.value / inputs.price) : ""}</span>
              </li>
            ))}
          </ul>
          <p className="cost-small">
            เปอร์เซ็นต์คิดจากราคาขาย ต้นทุนต่อเดือนหารด้วยจำนวนถุงที่ขายได้ ({fmt(result.soldPerMonth, 1)} ถุงต่อเดือน)
          </p>
        </div>
      </div>
    </section>
  );
}

/** A stand-up pouch filled bottom-up with each cost, profit on top, up to the selling price. */
function PouchChart({ result, price, hover, setHover }: { result: Result; price: number; hover: string | null; setHover: (id: string | null) => void }) {
  const top = 70;
  const bottom = 334;
  const scaleMax = Math.max(price, result.costPerPouch, 1);
  const h = (v: number) => (Math.max(0, v) / scaleMax) * (bottom - top);

  let y = bottom;
  const bars = SEGMENTS.map((s) => {
    const height = h(result.segments[s.id]);
    y -= height;
    return { ...s, y, height, value: result.segments[s.id] };
  });
  if (result.profitPerPouch > 0) {
    const height = h(result.profitPerPouch);
    y -= height;
    bars.push({ id: "profit" as SegmentId, name: "กำไร", color: PROFIT_COLOR, y, height, value: result.profitPerPouch });
  }
  const priceY = bottom - h(price);
  const costY = bottom - h(result.costPerPouch);
  // Keep the two labels apart when price and cost are close.
  const costLabelY = Math.max(costY, priceY + 44);

  return (
    <svg className="pouch-chart" viewBox="0 0 330 360" role="img" aria-label={`ต้นทุนต่อถุง ${baht(result.costPerPouch)} ราคาขาย ${baht(price)}`}>
      <defs>
        <clipPath id="pouch-shape">
          <path d={POUCH_PATH} />
        </clipPath>
      </defs>
      <rect x="92" y="18" width="36" height="30" rx="6" fill="#dcd2c0" />
      <rect x="98" y="44" width="24" height="16" fill="#cfc4b0" />
      <g clipPath="url(#pouch-shape)">
        <rect x="0" y="0" width="240" height="360" fill="#ffffff" />
        {bars.map((b) => (
          <rect
            key={b.id}
            x="0"
            width="240"
            y={b.y}
            height={Math.max(0, b.height - 2)}
            fill={b.color}
            opacity={hover && hover !== b.id ? 0.3 : 1}
            onMouseEnter={() => setHover(b.id)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${b.name} ${baht(b.value)}`}</title>
          </rect>
        ))}
      </g>
      <path d={POUCH_PATH} fill="none" stroke="#5b3a24" strokeWidth="3" strokeLinejoin="round" />
      <PriceTick y={priceY} labelY={priceY} title="ราคาขาย" value={baht(price)} />
      <PriceTick y={costY} labelY={costLabelY} title="ต้นทุน" value={baht(result.costPerPouch)} />
    </svg>
  );
}

function PriceTick({ y, labelY, title, value }: { y: number; labelY: number; title: string; value: string }) {
  return (
    <g>
      <line x1="200" x2="222" y1={y} y2={y} stroke="#22303a" strokeWidth="2" />
      <line x1="222" x2="230" y1={y} y2={labelY} stroke="#22303a" strokeWidth="2" />
      <text x="234" y={labelY - 4} className="pouch-chart__title">{title}</text>
      <text x="234" y={labelY + 18} className="pouch-chart__label">{value}</text>
    </g>
  );
}

const POUCH_PATH = "M 40 70 Q 40 60 52 60 L 188 60 Q 200 60 200 70 L 206 300 Q 208 330 186 334 L 54 334 Q 32 330 34 300 Z";

/* ---------- batch: beans + water → concentrate → pouches ---------- */

function BatchSection({ inputs, result, set }: { inputs: Inputs; result: Result; set: Setter }) {
  const yieldPct = inputs.waterLiters > 0 ? inputs.yieldLiters / inputs.waterLiters : 0;
  const shown = Math.min(result.pouchesPerBatch, 12);
  return (
    <section className="cost-card" aria-labelledby="batch-title">
      <h2 id="batch-title" className="cost-h2">1 รอบการชง ได้กี่ถุง</h2>
      <ol className="flow">
        <li className="flow__step">
          <BeansIcon />
          <p className="flow__big">{fmt(inputs.coffeeGrams)} ก. + {fmt(inputs.waterLiters, 2)} ลิตร</p>
          <p className="flow__small">{COFFEE_NAME} กับน้ำ สัดส่วน 1 : {fmt(result.ratio, 1)}</p>
        </li>
        <li className="flow__step">
          <JarIcon fill={yieldPct} />
          <p className="flow__big">ได้ {fmt(inputs.yieldLiters, 2)} ลิตร</p>
          <p className="flow__small">
            {pct(yieldPct)} ของน้ำที่ใช้ กากกาแฟดูดน้ำไว้ {fmt(result.absorbedMl)} มล.
          </p>
        </li>
        <li className="flow__step">
          <div className="flow__pouches" aria-hidden="true">
            {Array.from({ length: shown }, (_, i) => <PouchIcon key={i} />)}
            {result.leftoverMl > 0 && <CupIcon />}
          </div>
          <p className="flow__big">{result.pouchesPerBatch} ถุง × {fmt(inputs.pouchMl)} มล.</p>
          <p className="flow__small">
            {result.leftoverMl > 0 ? `เหลือ ${fmt(result.leftoverMl)} มล. ไว้ชิมหรือควบคุมคุณภาพ` : "บรรจุได้พอดี ไม่เหลือ"}
          </p>
        </li>
      </ol>
      {result.pouchesPerBatch === 0 && (
        <p className="warn" role="alert">ปริมาณที่ได้น้อยกว่าขนาดถุง ใส่ปริมาณ Cold Brew ที่ได้ หรือขนาดถุงใหม่</p>
      )}

      <div className="fields">
        <NumberField id="coffeeGrams" label="เมล็ดกาแฟต่อรอบ" unit="กรัม" value={inputs.coffeeGrams} onChange={(v) => set("coffeeGrams", v)} source="yours" />
        <NumberField id="coffeePrice" label="ราคาเมล็ดกาแฟ" unit="บาท/กก." value={inputs.coffeePricePerKg} onChange={(v) => set("coffeePricePerKg", v)} source="estimate" />
        <NumberField id="waterLiters" label="น้ำที่ใช้ชง" unit="ลิตร" step={0.1} value={inputs.waterLiters} onChange={(v) => set("waterLiters", v)} source={YOURS.has("waterLiters") ? "yours" : "estimate"} />
        <NumberField id="yieldLiters" label="Cold Brew ที่ได้" unit="ลิตร" step={0.1} value={inputs.yieldLiters} onChange={(v) => set("yieldLiters", v)} source="yours" />
        <NumberField id="pouchMl" label="ขนาดถุง" unit="มล." value={inputs.pouchMl} onChange={(v) => set("pouchMl", v)} source="yours" />
      </div>
      <p className="cost-small">
        ค่าเมล็ดกาแฟต่อรอบ {baht(result.coffeeCostPerBatch)} หรือ {baht(result.segments.coffee)} ต่อถุง
      </p>
    </section>
  );
}

/* ---------- the hidden-cost checklist ---------- */

function HiddenCosts({ inputs, result, setItem, set }: { inputs: Inputs; result: Result; setItem: (id: string, p: Partial<CostItem>) => void; set: Setter }) {
  const divisor: Record<Unit, number> = {
    batch: result.pouchesPerBatch || 1,
    pouch: 1,
    order: Math.max(1, inputs.pouchesPerOrder),
    month: result.soldPerMonth || 1,
  };
  return (
    <section className="cost-card" aria-labelledby="hidden-title">
      <h2 id="hidden-title" className="cost-h2">ต้นทุนแฝงที่มักลืม</h2>
      <p className="cost-p">
        นอกจากถุงและสติกเกอร์ ยังมีค่าใช้จ่ายเล็ก ๆ อีกหลายอย่าง ติ๊กออกถ้าไม่มี และแก้ตัวเลขให้ตรงกับของจริง
      </p>
      {UNIT_GROUPS.map((g) => {
        const items = inputs.items.filter((i) => i.unit === g.unit);
        const perPouch = items.filter((i) => i.enabled).reduce((n, i) => n + itemCost(i), 0) / divisor[g.unit];
        return (
          <div key={g.unit} className="group">
            <div className="group__head">
              <h3 className="group__title">{g.title}</h3>
              <p className="group__sum">≈ {baht(perPouch)} ต่อถุง</p>
            </div>
            <p className="cost-small">{g.hint}</p>
            <ul className="items">
              {items.map((i) => (
                <ItemRow key={i.id} item={i} perPouch={itemCost(i) / divisor[g.unit]} onChange={(p) => setItem(i.id, p)} />
              ))}
            </ul>
          </div>
        );
      })}
      <div className="group">
        <div className="group__head">
          <h3 className="group__title">คิดเป็นเปอร์เซ็นต์</h3>
        </div>
        <div className="fields">
          <NumberField id="lossRate" label="เสีย ตกหล่น และแจกชิม" unit="% ของที่ผลิต" value={round(inputs.lossRate * 100)} onChange={(v) => set("lossRate", v / 100)} source="estimate" />
          <NumberField id="feeRate" label="ค่าธรรมเนียมช่องทางขายและรับชำระ" unit="% ของราคา" value={round(inputs.feeRate * 100)} onChange={(v) => set("feeRate", v / 100)} source="estimate" />
        </div>
        <p className="cost-small">
          ค่าธรรมเนียมขึ้นกับช่องทาง เช่น ร้านค้าออนไลน์ บัตรเครดิต หรือแอปส่งอาหาร ถ้ารับโอนพร้อมเพย์เองใส่ 0
        </p>
      </div>
    </section>
  );
}

function ItemRow({ item, perPouch, onChange }: { item: CostItem; perPouch: number; onChange: (p: Partial<CostItem>) => void }) {
  const id = `item-${item.id}`;
  return (
    <li className={`item${item.enabled ? "" : " is-off"}`}>
      <label className="item__check">
        <input type="checkbox" checked={item.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
        <span>
          <span className="item__name">{item.name}</span> <Badge source={item.source} />
          {item.why && <span className="item__why">{item.why}</span>}
        </span>
      </label>
      <div className="item__inputs">
        {item.qtyLabel && (
          <>
            <NumberInput id={`${id}-qty`} label={`จำนวน${item.name}`} value={item.qty} step={0.5} onChange={(v) => onChange({ qty: v })} disabled={!item.enabled} />
            <span className="item__unit">{item.qtyLabel} ×</span>
          </>
        )}
        <NumberInput id={`${id}-price`} label={`ราคา${item.name}`} value={item.price} step={0.5} onChange={(v) => onChange({ price: v })} disabled={!item.enabled} />
        <span className="item__unit">บาท{item.qtyLabel ? `/${item.qtyLabel}` : ""}</span>
        <span className="item__per">{item.enabled ? `+${baht(perPouch)}/ถุง` : "ไม่คิด"}</span>
      </div>
    </li>
  );
}

/* ---------- sales: volume, break-even, pricing ---------- */

function SalesSection({ inputs, result, set }: { inputs: Inputs; result: Result; set: Setter }) {
  const be = result.breakEvenPouches;
  const track = Math.max(result.soldPerMonth, be ?? 0, 1) * 1.15;
  const losing = result.monthly.profit < 0;
  return (
    <section className="cost-card" aria-labelledby="sales-title">
      <h2 id="sales-title" className="cost-h2">ขายเดือนละเท่าไรถึงคุ้ม</h2>
      <div className="fields">
        <NumberField id="price" label="ราคาขายต่อถุง" unit="บาท" value={inputs.price} onChange={(v) => set("price", v)} source="estimate" />
        <NumberField id="batches" label="ชงต่อเดือน" unit="รอบ" value={inputs.batchesPerMonth} onChange={(v) => set("batchesPerMonth", v)} source="estimate" />
        <NumberField id="perOrder" label="ถุงต่อออเดอร์โดยเฉลี่ย" unit="ถุง" step={0.5} value={inputs.pouchesPerOrder} onChange={(v) => set("pouchesPerOrder", v)} source="estimate" />
      </div>

      <div className="month">
        <Stat label="รายรับต่อเดือน" value={baht(result.monthly.revenue)} />
        <Stat label="ต้นทุนต่อเดือน" value={baht(result.monthly.cost)} />
        <Stat label={losing ? "ขาดทุนต่อเดือน" : "กำไรต่อเดือน"} value={baht(Math.abs(result.monthly.profit))} tone={losing ? "loss" : "profit"} />
      </div>

      <figure className="breakeven">
        <figcaption className="breakeven__caption">
          {be === null
            ? "ราคานี้ยังไม่พอจ่ายต้นทุนต่อถุง ขายมากขึ้นก็ไม่คุ้ม ลองขึ้นราคาหรือลดต้นทุน"
            : `ต้องขายอย่างน้อย ${fmt(be)} ถุงต่อเดือน เพื่อจ่ายค่าใช้จ่ายรายเดือน ${baht(result.monthly.fixed)}`}
        </figcaption>
        <div className="breakeven__track" role="img" aria-label={`ขายได้ ${fmt(result.soldPerMonth, 1)} ถุงต่อเดือน${be !== null ? ` จุดคุ้มทุน ${fmt(be)} ถุง` : ""}`}>
          <div
            className={`breakeven__fill${be !== null && result.soldPerMonth >= be ? " is-ok" : ""}`}
            style={{ width: `${(result.soldPerMonth / track) * 100}%` }}
          />
          {be !== null && (
            <div className="breakeven__mark" style={{ left: `${(be / track) * 100}%` }}>
              <span>คุ้มทุน {fmt(be)}</span>
            </div>
          )}
        </div>
        <p className="breakeven__now">ตอนนี้ขายได้ {fmt(result.soldPerMonth, 1)} ถุงต่อเดือน (ผลิต {fmt(result.producedPerMonth)} ถุง)</p>
      </figure>

      <h3 className="group__title">ถ้าอยากได้กำไร ต้องตั้งราคาเท่าไร</h3>
      <ul className="targets">
        {[0.3, 0.4, 0.5].map((m) => {
          const p = result.priceForMargin(m);
          return (
            <li key={m}>
              <span className="targets__margin">กำไร {pct(m)}</span>
              <span className="targets__price">{p === null ? "—" : baht(p)}</span>
            </li>
          );
        })}
      </ul>
      <p className="cost-small">คิดจากต้นทุนชุดเดียวกันด้านบน และจำนวนขายต่อเดือนเท่าเดิม</p>

      <div className="cup">
        <CupIcon large />
        <div>
          <p className="cup__big">ต้นทุนแก้วละ {baht(result.costPerCup)}</p>
          <p className="cost-small">
            1 ถุงชงได้ {fmt(result.cupsPerPouch, 1)} แก้ว ถ้าใช้ Cold Brew แก้วละ{" "}
            <NumberInput id="mlPerCup" label="Cold Brew ต่อแก้ว (มล.)" value={inputs.mlPerCup} onChange={(v) => set("mlPerCup", v)} small /> มล.
            ตามสูตรในหน้าวิธีชง ไม่รวมนม น้ำแข็ง และแก้ว
          </p>
        </div>
      </div>
    </section>
  );
}

function Checklist() {
  return (
    <section className="cost-card" aria-labelledby="check-title">
      <h2 id="check-title" className="cost-h2">เรื่องที่ไม่ใช่ตัวเลข แต่ควรเช็ก</h2>
      <ul className="checklist">
        <li>ตรวจสอบกับ อย. ว่าต้องขอเลขสารบบอาหารหรือขออนุญาตสถานที่ผลิตหรือไม่ ค่าใช้จ่ายครั้งเดียวให้นำมาเฉลี่ยในค่าใช้จ่ายรายเดือน</li>
        <li>กำหนดอายุสินค้าจากการทดสอบจริง แล้วพิมพ์วันหมดอายุบนทุกถุง</li>
        <li>ถ้ารายรับทั้งปีเกิน 1.8 ล้านบาท ต้องจดทะเบียนภาษีมูลค่าเพิ่ม และรายได้ต้องยื่นภาษีเงินได้</li>
        <li>เก็บใบเสร็จทุกครั้ง แล้วอัปเดตตัวเลขในหน้านี้เมื่อราคาวัตถุดิบเปลี่ยน</li>
      </ul>
    </section>
  );
}

/* ---------- summary bar (phones) ---------- */

function StickySummary({ result, price }: { result: Result; price: number }) {
  const losing = result.profitPerPouch < 0;
  return (
    <div className="sticky" aria-hidden="true">
      <span>ต้นทุน <b>{baht(result.costPerPouch)}</b></span>
      <span>ขาย <b>{baht(price)}</b></span>
      <span className={losing ? "is-loss" : "is-profit"}>
        {losing ? "ขาดทุน" : "กำไร"} <b>{baht(Math.abs(result.profitPerPouch))}</b>
      </span>
    </div>
  );
}

/* ---------- small pieces ---------- */

type Setter = <K extends keyof Inputs>(key: K, value: Inputs[K]) => void;

function Badge({ source }: { source: "yours" | "estimate" }) {
  return <span className={`badge badge--${source}`}>{source === "yours" ? "ตัวเลขจริง" : "ประมาณ"}</span>;
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "profit" | "loss" }) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ""}`}>
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
      {note && <p className="stat__note">{note}</p>}
    </div>
  );
}

function NumberField({ id, label, unit, value, onChange, step = 1, source }: { id: string; label: string; unit: string; value: number; onChange: (v: number) => void; step?: number; source: "yours" | "estimate" }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label} <Badge source={source} />
      </label>
      <div className="field__row">
        <NumberInput id={id} value={value} step={step} onChange={onChange} />
        <span className="field__unit">{unit}</span>
      </div>
    </div>
  );
}

function MoneyInput({ id, value, onChange }: { id: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="field__row">
      <NumberInput id={id} value={value} onChange={onChange} big />
      <span className="field__unit">บาท</span>
    </div>
  );
}

/** A number box that lets people clear and retype without the value jumping to 0. */
function NumberInput({ id, label, value, onChange, step = 1, disabled, big, small }: { id: string; label?: string; value: number; onChange: (v: number) => void; step?: number; disabled?: boolean; big?: boolean; small?: boolean }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (parse(text) !== value) setText(String(value));
    // Only resync when the value changes from outside (reset, or the same value edited elsewhere).
  }, [value]);
  return (
    <input
      id={id}
      className={`num${big ? " num--big" : ""}${small ? " num--small" : ""}`}
      type="number"
      inputMode="decimal"
      min={0}
      step={step}
      value={text}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parse(e.target.value));
      }}
    />
  );
}

const parse = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const round = (n: number) => Math.round(n * 100) / 100;

function fmt(n: number, digits = 0) {
  return n.toLocaleString("th-TH", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
function baht(n: number) {
  return `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(n: number) {
  return `${(n * 100).toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;
}

function loadInputs(): Inputs {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Inputs> | null;
    if (!saved) return structuredClone(defaults);
    // Keep saved numbers, but follow the current list of cost items.
    const items = defaults.items.map((d) => ({ ...d, ...pick(saved.items?.find((i) => i.id === d.id)) }));
    return { ...defaults, ...saved, items };
  } catch {
    return structuredClone(defaults);
  }
}
function pick(i: CostItem | undefined): Partial<CostItem> {
  return i ? { qty: i.qty, price: i.price, enabled: i.enabled } : {};
}

/* ---------- icons ---------- */

function BeansIcon() {
  return (
    <svg className="flow__icon" viewBox="0 0 96 64" aria-hidden="true">
      {[[24, 40, -20], [44, 34, 15], [62, 42, -5], [34, 22, 30], [54, 18, -25]].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <ellipse rx="11" ry="8" fill="#8a4a1c" />
          <path d="M -8 0 Q 0 -4 8 0" stroke="#3b2414" strokeWidth="2" fill="none" />
        </g>
      ))}
      <path d="M 78 14 q 6 10 0 16 q -6 -6 0 -16 z" fill="#2a78d6" />
    </svg>
  );
}

function JarIcon({ fill }: { fill: number }) {
  const h = 44 * Math.min(1, Math.max(0, fill));
  return (
    <svg className="flow__icon" viewBox="0 0 96 64" aria-hidden="true">
      <rect x="28" y="6" width="40" height="54" rx="8" fill="#ffffff" stroke="#8fbbd6" strokeWidth="3" />
      <rect x="31" y={57 - h} width="34" height={h} rx="5" fill="#3b2414" />
      <rect x="31" y={57 - 44} width="34" height="2" fill="#8fbbd6" />
    </svg>
  );
}

function PouchIcon() {
  return (
    <svg className="flow__pouch" viewBox="0 0 24 32" aria-hidden="true">
      <rect x="9" y="0" width="6" height="5" rx="1.5" fill="#cfc4b0" />
      <path d="M 4 7 Q 4 5 6 5 L 18 5 Q 20 5 20 7 L 21 28 Q 21 31 18 31 L 6 31 Q 3 31 3 28 Z" fill="#5b3a24" />
    </svg>
  );
}

function CupIcon({ large }: { large?: boolean }) {
  return (
    <svg className={large ? "cup__icon" : "flow__cup"} viewBox="0 0 24 28" aria-hidden="true">
      <path d="M 3 4 L 21 4 L 18 26 L 6 26 Z" fill="#ffffff" stroke="#8fbbd6" strokeWidth="2" strokeLinejoin="round" />
      <path d="M 5 12 L 19 12 L 17.6 25 L 6.4 25 Z" fill="#8a4a1c" />
    </svg>
  );
}

