// ICONSIAM tab B: this month's sales and the stock at the store, per product, with the four-day
// replenishment plan (replenish.ts). Recorded, estimated and unknown values are labelled apart:
// a product without an opening balance or count at the store shows "unknown" stock, never 0.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths, consignmentMoves, consignmentStock, db, errorText, fmt, ICS, money, monthRange, newKey, qty, today, useQuery,
  type Doc, type StockSku,
} from "./api";
import { Icon } from "./icons";
import { Counter, ProductThumb, useToast } from "./motion";
import { addDays, daysBetween, outOfStockDays, plan, withDefaults, type Plan, type PlanSettings, type PlanStatus } from "./replenish";
import { Field, Notice, NumberInput, Select, itemName, useOps } from "./ui";
import { MonthStateBadge, dateLabel, monthLabel } from "./iconsiam";

const shortDate = (lang: string, d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short" });

const ACTION: PlanStatus[] = ["out_of_stock", "stockout_risk", "prepare_now", "due_soon"];
const ORDER: PlanStatus[] = ["out_of_stock", "stockout_risk", "prepare_now", "due_soon", "insufficient_data", "healthy"];

export interface Row {
  sku: StockSku; plan: Plan | null; opening: number; received: number; sold: number; returns: number; out: number; adjust: number;
  remaining: number; price: { price: number; from: "price_list" | "delivery_form"; ship_no?: string } | null; status: PlanStatus;
}

export function buildRow(sku: StockSku, now: string): Row {
  const f = sku.flows;
  const other = f.total - f.opening_recorded - f.received + f.sold - f.returns + f.removed + f.damaged - f.counted;
  const settings = withDefaults(sku.settings as Partial<PlanSettings> | null);
  const p = sku.tracked ? plan({
    today: now, onHand: Number(sku.on_hand), settings,
    dated: sku.dated_sales.map((d) => ({ start: d.start, end: d.end, qty: Number(d.qty) })),
    monthly: sku.monthly_sales.map((m) => ({ month: m.month, qty: Number(m.qty), days: Number(m.days) })),
    outOfStockDays: outOfStockDays(now, settings.window_days, Number(sku.balance_before_window), sku.daily),
    inbound: sku.inbound.map((i) => ({ ...i, qty: Number(i.qty) })),
  }) : null;
  const price = sku.price ? { price: Number(sku.price.price), from: "price_list" as const }
    : sku.form_price ? { price: Number(sku.form_price.price), from: "delivery_form" as const, ship_no: sku.form_price.ship_no } : null;
  return {
    sku, plan: p, opening: Number(sku.opening) + Number(f.opening_recorded), received: Number(f.received), sold: Number(f.sold),
    returns: Number(f.returns), out: Number(f.removed) + Number(f.damaged), adjust: Number(f.counted) + other,
    remaining: Number(sku.opening) + Number(f.total), price, status: p?.status ?? "insufficient_data",
  };
}

export function StockTab({ params }: { params: URLSearchParams }) {
  const { t, ref, lang } = useOps();
  const now = today();
  const [month, setMonth] = useState(params.get("month") ?? now.slice(0, 7));
  const locs = ref.locations.filter((l) => l.kind === "consignment" && l.active);
  const [loc, setLoc] = useState(params.get("loc") ?? ICS.location);
  const [search, setSearch] = useState("");
  const [onlyAction, setOnlyAction] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery(() => consignmentStock(loc, `${month}-01`), [loc, month]);
  const d = q.data;
  const isCurrent = month === now.slice(0, 7);

  const rows = useMemo(() => (d?.items ?? [])
    .filter((s) => s.active || Number(s.on_hand) !== 0 || s.month_sales || s.inbound.length)
    .map((s) => buildRow(s, now)), [d, now]);
  const shown = rows
    .filter((r) => !search || `${r.sku.name_th} ${r.sku.name_en} ${r.sku.code} ${r.sku.iconsiam_code ?? ""}`.toLowerCase().includes(search.toLowerCase()))
    .filter((r) => !onlyAction || ACTION.includes(r.status))
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.sku.name_en.localeCompare(b.sku.name_en));

  const unitsSoFar = rows.reduce((s, r) => s + Number(r.sku.month_sales?.final_qty ?? 0) + Number(r.sku.month_sales?.prov_qty ?? 0), 0);
  const valueSoFar = rows.reduce((s, r) => s + Number(r.sku.month_sales?.final_net ?? 0) + Number(r.sku.month_sales?.prov_net ?? 0), 0);
  const tracked = rows.filter((r) => r.sku.tracked);
  const stock = tracked.length ? tracked.reduce((s, r) => s + Math.max(0, Number(r.sku.on_hand)), 0) : null;
  const action = rows.filter((r) => ACTION.includes(r.status));
  const inbound = rows.flatMap((r) => r.sku.inbound);
  const ships = [...new Map(inbound.map((i) => [i.shipment_id, i])).values()];
  const next = ships.map((s) => s.expected_arrival ?? s.planned_dispatch).filter(Boolean).sort()[0] ?? null;
  const st = d?.state;
  const latest = st?.updates?.filter((u) => u.status === "active").slice(-1)[0];
  const openRow = rows.find((r) => r.sku.item_id === open) ?? null;

  return (
    <div className="ics__body">
      <div className="panel ics__filters">
        <div className="row">
          <Field label={t.ics.month}>{(id) => (
            <input id={id} type="month" value={month} max={now.slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          )}</Field>
          {locs.length > 1 && (
            <Field label={t.ics.location}>{(id) => (
              <Select id={id} value={loc} onChange={setLoc} options={locs.map((l) => ({ value: l.code, label: lang === "th" ? l.name_th : l.name_en }))} />
            )}</Field>
          )}
          <Field label={t.ics.search}>{(id) => <input id={id} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}</Field>
          <label className="check"><input type="checkbox" checked={onlyAction} onChange={(e) => setOnlyAction(e.target.checked)} /> {t.ics.needAction}</label>
        </div>
        {st && (
          <p className="ics__status">
            <MonthStateBadge state={st.state} />
            {st.through ? <span>{fmt(t.ics.dataThrough, { date: dateLabel(lang, st.through) })}</span> : <span className="muted">{t.ics.noData}</span>}
            {latest && <span className="muted">{fmt(t.ics.dataSource, { source: `${t.ics.sourceKind[latest.kind]} · ${latest.source_ref}` })}</span>}
          </p>
        )}
      </div>

      {q.error ? <Notice kind="error">{errorText(t, q.error)}</Notice> : !d ? <p>{t.loading}</p> : (
        <>
          <div className="ics__cards">
            <div className="kcard">
              <span className="kcard__icon"><Icon name="cart" size={22} /></span>
              <span className="kcard__label">{t.ics.unitsSoFar}</span>
              <strong className="kcard__value"><Counter value={unitsSoFar} format={qty} missing="–" /></strong>
              <span className="kcard__sub">{t.ics.valueSoFar} {fmt(t.baht, { n: money(valueSoFar) })}</span>
              {st && st.state === "provisional" && <span className="mstate mstate--provisional">{t.ics.provisionalLabel}</span>}
            </div>
            <div className={stock == null ? "kcard kcard--missing" : "kcard"}>
              <span className="kcard__icon"><Icon name="box" size={22} /></span>
              <span className="kcard__label">{t.ics.stockOnHand}</span>
              <strong className="kcard__value"><Counter value={stock} format={qty} missing={<span className="missing">{t.ics.unknown}</span>} /></strong>
              {rows.length > tracked.length && <span className="kcard__sub">{fmt(t.ics.stockUntracked, { n: rows.length - tracked.length })}</span>}
            </div>
            <div className={action.length ? "kcard kcard--alert" : "kcard"}>
              <span className="kcard__icon"><Icon name="alert" size={22} /></span>
              <span className="kcard__label">{t.ics.needAction}</span>
              <strong className="kcard__value"><Counter value={action.length} format={(n) => String(Math.round(n))} missing="–" /></strong>
              <span className="kcard__sub">{action.slice(0, 3).map((r) => itemName(lang, r.sku)).join(", ") || t.ics.nothing}</span>
            </div>
            <div className="kcard">
              <span className="kcard__icon"><Icon name="truck" size={22} /></span>
              <span className="kcard__label">{t.ics.upcoming}</span>
              <strong className="kcard__value"><Counter value={ships.length} format={(n) => String(Math.round(n))} missing="–" /></strong>
              <span className="kcard__sub">{next ? fmt(t.ics.nextArrival, { date: dateLabel(lang, next) }) : t.ics.nothing}</span>
            </div>
          </div>

          <section className="panel">
            <div className="scroll">
              <table className="table skus">
                <thead><tr>
                  <th>{t.ics.colSku}</th><th>{t.ics.colStatus}</th><th className="n">{t.ics.colRemaining}</th><th>{t.ics.colCover}</th>
                  <th className="n">{t.ics.colRecommend}</th><th>{t.ics.colPrepBy}</th><th>{t.ics.colStockout}</th><th className="n">{t.ics.colDemand}</th>
                  <th className="n">{t.ics.colOpening}</th><th className="n">{t.ics.colReceived}</th><th className="n">{t.ics.colSold}</th>
                  <th className="n">{t.ics.colOut}</th><th className="n">{t.ics.colAdj}</th><th className="n">{t.ics.colRetail}</th>
                  <th><span className="sr-only">{t.ics.colAction}</span></th>
                </tr></thead>
                <tbody>
                  {shown.map((r) => <SkuRow key={r.sku.item_id} r={r} isCurrent={isCurrent} onOpen={() => setOpen(r.sku.item_id)} />)}
                </tbody>
              </table>
            </div>
            <p className="dash__note"><Icon name="alert" size={18} /> {t.ics.retailNote}</p>
          </section>
        </>
      )}
      {openRow && <Drawer r={openRow} loc={loc} month={month} close={() => setOpen(null)} reload={q.reload} />}
    </div>
  );
}

export function StatusPill({ status }: { status: PlanStatus }) {
  const { t } = useOps();
  const icon = status === "healthy" ? "check" : status === "insufficient_data" ? "chart" : "alert";
  return <span className={`pstatus pstatus--${status}`}><Icon name={icon} size={16} /> {t.ics.status[status]}</span>;
}

function SkuRow({ r, isCurrent, onOpen }: { r: Row; isCurrent: boolean; onOpen: () => void }) {
  const { t, lang } = useOps();
  const s = r.sku, p = r.plan;
  const name = itemName(lang, s);
  const unknown = <span className="missing">{t.ics.unknown}</span>;
  const size = s.size_value ? `${qty(s.size_value)} ${s.size_unit ?? ""}` : "";
  return (
    <tr className={r.remaining < 0 ? "neg" : undefined}>
      <td data-label={t.ics.colSku}>
        <span className="sku">
          <ProductThumb code={s.code} alt="" />
          <span className="sku__text"><strong>{name}</strong><span className="muted small">{[size, s.code].filter(Boolean).join(" · ")}</span></span>
        </span>
      </td>
      <td data-label={t.ics.colStatus}>{isCurrent ? <StatusPill status={r.status} /> : "–"}</td>
      <td className="n" data-label={t.ics.colRemaining}>
        {s.tracked ? <strong>{qty(r.remaining)}</strong> : unknown}
        {r.remaining < 0 && <span className="badge badge--neg" title={t.ics.negativeNote}>{t.ics.negative}</span>}
      </td>
      <td data-label={t.ics.colCover}>{isCurrent && p ? <CoverBar p={p} /> : "–"}</td>
      <td className="n" data-label={t.ics.colRecommend}>{isCurrent && p?.recommended != null ? <strong>{qty(p.recommended)}</strong> : "–"}</td>
      <td data-label={t.ics.colPrepBy}>{isCurrent && p?.prepDeadline ? shortDate(lang, p.prepDeadline < today() ? today() : p.prepDeadline) : "–"}</td>
      <td data-label={t.ics.colStockout}>{isCurrent && p?.stockoutDate ? <>{shortDate(lang, p.stockoutDate)}<small className="muted"> {t.ics.estimated}</small></> : "–"}</td>
      <td className="n sku-x" data-label={t.ics.colDemand}>
        {p?.demand.daily != null ? <>{fmt(t.ics.perDay, { n: qty(Math.round(p.demand.daily * 100) / 100) })}<small className="muted"> {p.demand.method === "dated" ? "" : t.ics.estimated}</small></> : unknown}
      </td>
      <td className="n sku-x" data-label={t.ics.colOpening}>
        {s.tracked ? qty(r.opening) : unknown}
        <small className={s.opening_confirmed ? "tag tag--ok" : "tag"}>{s.opening_confirmed ? t.ics.confirmed : t.ics.unconfirmed}</small>
      </td>
      <td className="n sku-x" data-label={t.ics.colReceived}>{qty(r.received)}</td>
      <td className="n sku-x" data-label={t.ics.colSold}>{qty(r.sold)}</td>
      <td className="n sku-x" data-label={t.ics.colOut}>{r.returns ? `+${qty(r.returns)} / ` : ""}{qty(r.out)}</td>
      <td className="n sku-x" data-label={t.ics.colAdj}>{r.adjust ? (r.adjust > 0 ? "+" : "") + qty(r.adjust) : "0"}</td>
      <td className="n sku-x" data-label={t.ics.colRetail}>
        {!s.tracked ? unknown : r.price ? <>{money(Math.max(0, r.remaining) * r.price.price)}<small className="muted"> {r.price.from === "delivery_form" ? t.ics.estimated : ""}</small></> : <span className="missing">{t.ics.noPrice}</span>}
      </td>
      <td data-label={t.ics.colAction}><button type="button" className="btn btn--small" onClick={onOpen}>{t.ics.details}<span className="sr-only"> {name}</span></button></td>
    </tr>
  );
}

/** Days of cover against the lead time: the line marks the lead time, the bar the cover. */
function CoverBar({ p }: { p: Plan }) {
  const { t } = useOps();
  if (p.cover == null) return <span className="muted">–</span>;
  const scale = Math.max(p.leadTime * 3, 1);
  const w = Math.min(p.cover / scale, 1) * 100;
  return (
    <span className={`cover cover--${p.status}`} title={fmt(t.ics.leadTime, { prep: p.settings.prep_days, transit: p.settings.transit_days ?? 0, total: p.leadTime })}>
      <span className="cover__track" aria-hidden="true">
        <span className="cover__bar" style={{ width: `${w}%` }} />
        <span className="cover__lead" style={{ left: `${(p.leadTime / scale) * 100}%` }} />
      </span>
      <span className="cover__text">{fmt(t.ics.days, { n: qty(Math.floor(p.cover * 10) / 10) })}</span>
    </span>
  );
}

// ---------- details drawer ----------

function Drawer({ r, loc, month, close, reload }: { r: Row; loc: string; month: string; close: () => void; reload: () => void }) {
  const { t, lang } = useOps();
  const ref_ = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref_.current;
    if (d && !d.open) d.showModal();
    const onClose = () => close();
    d?.addEventListener("close", onClose);
    return () => d?.removeEventListener("close", onClose);
  }, [close]);
  const s = r.sku;
  return (
    <dialog ref={ref_} className="drawer" aria-labelledby="drawer-title">
      <div className="drawer__head">
        <ProductThumb code={s.code} alt="" size={56} />
        <div>
          <h2 id="drawer-title">{itemName(lang, s)}</h2>
          <p className="muted small">{[s.code, s.iconsiam_code, s.barcode].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" className="btn btn--small drawer__close" onClick={() => ref_.current?.close()}>{t.ics.close}</button>
      </div>
      <div className="drawer__body">
        {r.plan && <StatusPill status={r.status} />}
        {r.remaining < 0 && <p className="warn"><span aria-hidden="true">⚠</span> {t.ics.negativeNote}</p>}
        <StockFlow r={r} month={month} />
        {r.plan && <Timeline p={r.plan} />}
        {r.plan && <Calc p={r.plan} />}
        <div className="row">
          {r.plan?.recommended ? <a className="btn btn--primary" href={`#/iconsiam/ship/new?item=${s.item_id}&qty=${r.plan.recommended}`}><Icon name="truck" /> {t.ics.plan}</a> : null}
          <a className="btn" href="#/new/count"><Icon name="count" /> {t.ics.countLink}</a>
        </div>
        <Moves itemId={s.item_id} loc={loc} month={month} />
        <EventForm itemId={s.item_id} loc={loc} done={reload} />
        <SettingsForm sku={s} loc={loc} done={reload} />
      </div>
    </dialog>
  );
}

function StockFlow({ r, month }: { r: Row; month: string }) {
  const { t, lang } = useOps();
  const steps: { key: string; label: string; v: number; sign: "" | "+" | "−" | "±" }[] = [
    { key: "opening", label: t.ics.flowOpening, v: r.opening, sign: "" },
    { key: "received", label: t.ics.flowReceived, v: r.received, sign: "+" },
    ...(r.returns ? [{ key: "returns", label: t.ics.flowReturns, v: r.returns, sign: "+" as const }] : []),
    { key: "sold", label: t.ics.flowSold, v: r.sold, sign: "−" },
    { key: "removed", label: t.ics.flowRemoved, v: r.out, sign: "−" },
    ...(r.adjust ? [{ key: "adjust", label: t.ics.flowAdjust, v: r.adjust, sign: "±" as const }] : []),
    { key: "remaining", label: t.ics.flowRemaining, v: r.remaining, sign: "" },
  ];
  const max = Math.max(1, ...steps.map((s) => Math.abs(s.v)));
  return (
    <section className="sflow" aria-label={t.ics.flowTitle}>
      <h3>{t.ics.flowTitle} · {monthLabel(lang, month)}</h3>
      {!r.sku.tracked && <p className="muted small">{t.ics.unknown}: {t.ics.colOpening} {t.ics.unconfirmed}</p>}
      <ol className="sflow__steps">
        {steps.map((s, i) => (
          <li key={s.key} className={`sflow__step sflow__step--${s.key}`} style={{ ["--i" as string]: i }}>
            <span className="sflow__label">{s.label}</span>
            <strong className="sflow__value">{s.v && s.sign && s.sign !== "±" ? s.sign : ""}{qty(s.v)}</strong>
            <span className="sflow__bar" aria-hidden="true"><span style={{ width: `${(Math.abs(s.v) / max) * 100}%` }} /></span>
          </li>
        ))}
      </ol>
      <p className="small muted">{fmt(t.ics.flowSummary, {
        opening: qty(r.opening), received: qty(r.received), returns: qty(r.returns), sold: qty(r.sold), removed: qty(r.out),
        adjust: qty(r.adjust), remaining: qty(r.remaining),
      })}</p>
    </section>
  );
}

/** Prepare → dispatch → receive, against the expected stockout, on one date line. */
function Timeline({ p }: { p: Plan }) {
  const { t, lang } = useOps();
  const now = today();
  const start = p.prepDeadline && p.prepDeadline > now ? p.prepDeadline : now;
  const dispatch = addDays(start, p.settings.prep_days);
  const arrive = addDays(dispatch, p.settings.transit_days ?? 0);
  const points = [
    { key: "prepare", label: t.ics.tlPrepare, date: start },
    { key: "dispatch", label: t.ics.tlDispatch, date: dispatch },
    { key: "receive", label: t.ics.tlReceive, date: arrive },
    ...(p.stockoutDate ? [{ key: "stockout", label: t.ics.tlStockout, date: p.stockoutDate }] : []),
  ];
  const end = points.reduce((m, x) => (x.date > m ? x.date : m), addDays(now, 7));
  const span = Math.max(1, daysBetween(now, end));
  const at = (d: string) => `${Math.min(100, Math.max(0, (daysBetween(now, d) / span) * 100))}%`;
  return (
    <section className="tl" aria-label={t.ics.timeline}>
      <h3>{t.ics.timeline}</h3>
      <div className="tl__track" aria-hidden="true">
        {p.gap && <span className="tl__gap" style={{ left: at(p.gap.from), width: `calc(${at(p.gap.to)} - ${at(p.gap.from)})` }} />}
        <span className="tl__lead" style={{ left: at(start), width: `calc(${at(arrive)} - ${at(start)})` }} />
        {points.map((x) => <span key={x.key} className={`tl__dot tl__dot--${x.key}`} style={{ left: at(x.date) }} />)}
      </div>
      <ol className="tl__legend">
        {points.map((x) => <li key={x.key}><i className={`tl__dot tl__dot--${x.key}`} aria-hidden="true" /> {x.label}: <strong>{dateLabel(lang, x.date)}</strong></li>)}
      </ol>
      <p className="small">{fmt(t.ics.leadTime, { prep: p.settings.prep_days, transit: p.settings.transit_days ?? 0, total: p.leadTime })}
        {!p.transitSet && <> · <span className="muted">{t.ics.transitNotSet}</span></>}</p>
      {p.gap && p.gap.days > 0 && (
        <p className="warn"><span aria-hidden="true">⚠</span> {fmt(p.gap.reason === "late_inbound" ? t.ics.gapLate : t.ics.gapLead, {
          from: dateLabel(lang, p.gap.from), to: dateLabel(lang, p.gap.to), days: p.gap.days,
        })}</p>
      )}
    </section>
  );
}

function Calc({ p }: { p: Plan }) {
  const { t, lang } = useOps();
  const d = p.demand;
  const r2 = (n: number | null) => (n == null ? "–" : qty(Math.round(n * 100) / 100));
  return (
    <section className="calc">
      <h3>{t.ics.calcTitle}</h3>
      <p className="row"><span className="tag">{t.ics.method[d.method]}</span><span className="tag">{t.ics.confidence[d.confidence]}</span></p>
      <ul className="plain small">
        <li>{d.method === "dated" ? fmt(t.ics.calcDemand, { daily: r2(d.daily), units: r2(d.units), days: d.observedDays, from: dateLabel(lang, d.from), to: dateLabel(lang, d.to) })
          : d.method === "monthly" ? fmt(t.ics.calcMonthly, { units: r2(d.units), days: d.observedDays, from: monthLabel(lang, d.from ?? ""), to: monthLabel(lang, d.to ?? "") })
            : d.method === "manual" ? fmt(t.ics.calcManual, { note: p.settings.manual_note ?? "" }) : t.ics.calcNone}</li>
        {d.excludedOutOfStock > 0 && <li>{fmt(t.ics.calcOos, { n: d.excludedOutOfStock })}</li>}
        {d.daily != null && <>
          <li>{fmt(t.ics.calcRop, { rop: r2(p.reorderPoint), daily: r2(d.daily), lead: p.leadTime, safety: r2(p.safetyStock) })}</li>
          <li>{fmt(t.ics.calcTarget, { target: r2(p.targetStock), daily: r2(d.daily), lead: p.leadTime, cover: p.settings.target_cover_days ?? 14, safety: r2(p.safetyStock) })}
            {p.targetCoverDefaulted && <> · <span className="muted">{fmt(t.ics.coverDefault, { n: 14 })}</span></>}</li>
          <li>{fmt(t.ics.calcPosition, { onhand: r2(p.sellable), inbound: r2(p.confirmedInbound), position: r2(p.position) })}</li>
          <li>{fmt(t.ics.calcRecommend, { qty: r2(p.recommended), pack: p.settings.pack_multiple, min: p.settings.min_shipment })}
            {p.shelfCapped && <> · {t.ics.shelfCapped}</>}</li>
        </>}
      </ul>
    </section>
  );
}

function Moves({ itemId, loc, month }: { itemId: string; loc: string; month: string }) {
  const { t, lang } = useOps();
  const end = monthRange(month).to < today() ? monthRange(month).to : today();
  const q = useQuery(() => consignmentMoves(loc, itemId, `${addMonths(month, -2)}-01`, end), [loc, itemId, month, end]);
  const kinds = Object.keys(t.ics.kind) as (keyof typeof t.ics.kind)[];
  const label = (k: string) => t.ics.kind[kinds.find((x) => x !== "other" && k.startsWith(x)) ?? "other"];
  return (
    <section>
      <h3>{t.ics.moves}</h3>
      {q.error ? <Notice kind="error">{errorText(t, q.error)}</Notice> : !q.data ? <p>{t.loading}</p> : !q.data.length ? <p className="muted">{t.ics.movesEmpty}</p> : (
        <div className="scroll">
          <table className="table">
            <tbody>
              {[...q.data].reverse().map((m) => (
                <tr key={m.id}>
                  <td>{dateLabel(lang, m.date)}</td>
                  <td>{label(m.kind)}{m.reason && m.reason !== m.kind ? <span className="muted small"> · {m.reason}</span> : null}
                    {m.provisional && <span className="badge badge--neg"> {t.ics.negative}</span>}</td>
                  <td className="n">{Number(m.qty) > 0 ? "+" : ""}{qty(m.qty)}</td>
                  <td>{m.shipment_id ? <a href={`#/iconsiam/ship/${m.shipment_id}`}>{m.ref}</a> : m.doc_type !== "sales_update" ? <a href={`#/record/${m.doc_id}`}>{m.ref}</a> : <span className="mono">{m.ref}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Customer return (sellable or not), damage or expiry at the store, as an approved adjustment. */
function EventForm({ itemId, loc, done }: { itemId: string; loc: string; done: () => void }) {
  const { t } = useOps();
  const [kind, setKind] = useState<"customer_return" | "damage" | "expiry">("customer_return");
  const [sellable, setSellable] = useState(true);
  const [n, setN] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keys, setKeys] = useState(() => [newKey(), newKey()]);
  const toast = useToast();
  const submit = async () => {
    const q = Number(n);
    if (!(q > 0)) { setError(t.errors.qty_positive); return; }
    if (!reason.trim()) { setError(t.errors.reason_required); return; }
    setBusy(true); setError(null);
    const post = (key: string, code: string, signed: number, why: string) => db.rpc("post_document", { p: {
      doc_type: "adjustment", doc_date: today(), location_code: loc, client_key: key,
      data: { reason: why, reason_code: code }, lines: [{ item_id: itemId, qty: signed }],
    } });
    try {
      // An unsellable return is recorded as returned and then written off, so both stay visible.
      const first = await post(keys[0], kind, kind === "customer_return" ? q : -q, reason.trim());
      if (first.error) throw first.error;
      if (kind === "customer_return" && !sellable) {
        const second = await post(keys[1], "damage", -q, `${t.ics.eventKind.customer_return}: ${reason.trim()}`);
        if (second.error) throw second.error;
      }
      setKeys([newKey(), newKey()]);
      setN(""); setReason("");
      toast.show((first.data as Doc).status === "pending" ? t.ics.eventPending : t.ics.saved);
      done();
    } catch (e) { setError(errorText(t, e)); } finally { setBusy(false); }
  };
  return (
    <details className="card subform">
      <summary><Icon name="count" /> {t.ics.event}</summary>
      <p className="small muted">{t.ics.eventNote}</p>
      <div className="grid">
        <Field label={t.ics.kindLabel}>{(id) => <Select id={id} value={kind} onChange={(v) => setKind(v as typeof kind)}
          options={(["customer_return", "damage", "expiry"] as const).map((k) => ({ value: k, label: t.ics.eventKind[k] }))} />}</Field>
        <Field label={t.ics.eventQty}>{(id) => <NumberInput id={id} value={n} onChange={setN} step="1" />}</Field>
        {kind === "customer_return" && <label className="check"><input type="checkbox" checked={sellable} onChange={(e) => setSellable(e.target.checked)} /> {t.ics.sellable}</label>}
        <Field label={t.ics.eventReason} wide>{(id) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row row--end"><button type="button" className="btn btn--primary" disabled={busy} onClick={submit}>{busy ? t.saving : t.ics.save}</button></div>
      {toast.node}
    </details>
  );
}

function SettingsForm({ sku, loc, done }: { sku: StockSku; loc: string; done: () => void }) {
  const { t } = useOps();
  const s = withDefaults(sku.settings as Partial<PlanSettings> | null);
  const str = (v: number | null) => (v == null ? "" : String(v));
  const [f, setF] = useState({
    prep_days: str(s.prep_days), transit_days: str(s.transit_days), safety_days: str(s.safety_days), target_cover_days: str(s.target_cover_days),
    pack_multiple: str(s.pack_multiple), min_shipment: str(s.min_shipment), shelf_life_days: str(s.shelf_life_days),
    window_days: str(s.window_days), manual_daily: str(s.manual_daily),
  });
  const [verified, setVerified] = useState(s.shelf_life_verified);
  const [method, setMethod] = useState(s.method);
  const [note, setNote] = useState(s.manual_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const num = (k: keyof typeof f, label: string, hint?: string) => (
    <Field label={label} hint={hint}>{(id, dsc) => <NumberInput id={id} value={f[k]} step={k === "manual_daily" ? "any" : "1"} describedBy={dsc} placeholder={t.ics.notSet} onChange={(v) => setF({ ...f, [k]: v })} />}</Field>
  );
  const save = async () => {
    setBusy(true); setError(null);
    const { error: err } = await db.rpc("save_plan_settings", { p: {
      location_code: loc, item_id: sku.item_id, ...f, shelf_life_verified: verified, method, manual_note: note,
    } });
    setBusy(false);
    if (err) setError(errorText(t, err)); else { toast.show(t.ics.saved); done(); }
  };
  return (
    <details className="card subform">
      <summary><Icon name="settings" /> {t.ics.settings}</summary>
      <div className="grid">
        {num("prep_days", t.ics.prepDays)}
        {num("transit_days", t.ics.transitDays)}
        {num("safety_days", t.ics.safetyDays)}
        {num("target_cover_days", t.ics.targetCover, fmt(t.ics.coverDefault, { n: 14 }))}
        {num("pack_multiple", t.ics.packMultiple)}
        {num("min_shipment", t.ics.minShipment)}
        {num("shelf_life_days", t.ics.shelfLife)}
        <label className="check"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> {t.ics.shelfVerified}</label>
        {num("window_days", t.ics.window)}
        <Field label={t.ics.methodLabel}>{(id) => <Select id={id} value={method} onChange={(v) => setMethod(v as PlanSettings["method"])}
          options={(["auto", "dated", "monthly", "manual"] as const).map((m) => ({ value: m, label: t.ics.methodOpt[m] }))} />}</Field>
        {method === "manual" && <>
          {num("manual_daily", t.ics.manualDaily)}
          <Field label={t.ics.manualNote} wide>{(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        </>}
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row row--end"><button type="button" className="btn btn--primary" disabled={busy} onClick={save}>{busy ? t.saving : t.ics.save}</button></div>
      {toast.node}
    </details>
  );
}
