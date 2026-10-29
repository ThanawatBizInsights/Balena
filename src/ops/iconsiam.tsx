// ICONSIAM workspace: two tabs (Total sales, Current sales & stock) plus deliveries, sales updates,
// code mappings and document details. Every figure comes from consignment_sales() /
// consignment_stock(), which read the authoritative sales layer: official reports replace interim
// figures for the dates they cover, and superseded updates are listed but never added in.
import { useMemo, useRef, useState } from "react";
import { opsText } from "../i18n/ops";
import type { Lang } from "../i18n/lang";
import { consignmentSales, errorText, fmt, money, qty, seesMoney, today, useQuery, type EffLine, type MonthState, type SalesMonth } from "./api";
import { Icon } from "./icons";
import { Counter, useWiggle } from "./motion";
import { Field, Notice, Select, useNames, useOps } from "./ui";
import { StockTab } from "./iconsiam-stock";

export function IconsiamPage({ tab, params }: { tab: "sales" | "stock"; params: URLSearchParams }) {
  const { t, ref } = useOps();
  const root = useRef<HTMLElement>(null);
  useWiggle(root);
  const money_ = seesMoney(ref.me.role);
  const active = money_ ? tab : "stock";
  return (
    <section className="ics" ref={root}>
      <header className="ics__head">
        <img className="ics__whale" src="/images/balena-whale-sticker.webp" alt="" width="56" height="56" />
        <div>
          <h1>{t.ics.title}</h1>
          <p className="muted">{t.ics.subtitle}</p>
        </div>
        <div className="ics__actions">
          {money_ && <a className="btn btn--primary" href="#/iconsiam/import"><Icon name="upload" /> {t.ics.addUpdate}</a>}
          <a className="btn" href="#/iconsiam/ship/new"><Icon name="truck" /> {t.ics.planDelivery}</a>
          <a className="btn" href="#/iconsiam/ship"><Icon name="box" /> {t.ics.deliveries}</a>
          <a className="btn" href="#/iconsiam/maps"><Icon name="link" /> {t.ics.mappings}</a>
          {ref.isOwner && <a className="btn" href="#/iconsiam/profile"><Icon name="settings" /> {t.ics.profile}</a>}
        </div>
      </header>
      <nav className="tabs" aria-label={t.ics.tabsLabel}>
        {money_ && <a className="tab" href="#/iconsiam?tab=sales" aria-current={active === "sales" ? "page" : undefined}><Icon name="chart" /> {t.ics.tabSales}</a>}
        <a className="tab" href="#/iconsiam?tab=stock" aria-current={active === "stock" ? "page" : undefined}><Icon name="box" /> {t.ics.tabStock}</a>
      </nav>
      {active === "sales" ? <SalesTab params={params} /> : <StockTab params={params} />}
    </section>
  );
}

// ---------- shared ----------

export function MonthStateBadge({ state }: { state: MonthState }) {
  const { t } = useOps();
  return <span className={`mstate mstate--${state}`} title={t.ics.stateHint[state]}>{t.ics.state[state]}</span>;
}

export const monthLabel = (lang: Lang, month: string, style: "short" | "long" = "long") =>
  new Date(`${month.slice(0, 7)}-01T00:00:00`).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { month: style, year: style === "long" ? "numeric" : undefined });

export const dateLabel = (lang: Lang, d: string | null | undefined) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–";

/** One product-month in the chosen view: official figures always, interim ones only when included. */
interface Part { month: string; item: string; units: number; provUnits: number; net: number; provNet: number;
  gross: number | null; discount: number | null; gp: number | null; payable: number | null; state: MonthState }

const n0 = (v: number | null | undefined) => Number(v ?? 0);
const sumKnown = (xs: (number | null)[]) => (xs.some((x) => x != null) ? xs.reduce<number>((s, x) => s + n0(x), 0) : null);

function partsOf(months: SalesMonth[], chosen: Set<string>, products: Set<string>, withProv: boolean): Part[] {
  const out: Part[] = [];
  for (const m of months) {
    const key = m.month.slice(0, 7);
    if (!chosen.has(key) || m.state === "open") continue;
    if (!withProv && m.state === "provisional") continue;
    for (const l of m.items as EffLine[]) {
      if (products.size && !products.has(l.item_id)) continue;
      const pu = withProv ? n0(l.prov_qty) : 0, pn = withProv ? n0(l.prov_net) : 0;
      if (!n0(l.final_qty) && !pu && !n0(l.final_net) && !pn) continue;
      out.push({ month: key, item: l.item_id, units: n0(l.final_qty), provUnits: pu, net: n0(l.final_net), provNet: pn,
        gross: l.final_gross, discount: l.final_discount, gp: l.final_gp, payable: l.final_payable, state: m.state });
    }
  }
  return out;
}

// ---------- Tab A: total sales ----------

function SalesTab({ params }: { params: URLSearchParams }) {
  const { t, lang, ref } = useOps();
  const names = useNames();
  const now = today();
  const thisYear = Number(now.slice(0, 4));
  const [year, setYear] = useState(Number(params.get("year")) || thisYear);
  const to = year === thisYear ? now : `${year}-12-31`;
  const rep = useQuery(() => consignmentSales(`${year}-01-01`, to), [year, to]);
  const months = useMemo(() => rep.data?.months ?? [], [rep.data]);
  const [withProv, setWithProv] = useState(params.get("prov") === "1");
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [products, setProducts] = useState<Set<string>>(new Set());
  const [measure, setMeasure] = useState<"units" | "net">("units");
  const [replay, setReplay] = useState(0);
  const [exportLang, setExportLang] = useState<Lang>(lang);

  const withData = months.filter((m) => m.state !== "open" && (withProv || m.state !== "provisional")).map((m) => m.month.slice(0, 7));
  const chosen = picked ?? new Set(withData);
  const parts = useMemo(() => partsOf(months, chosen, products, withProv), [months, chosen, products, withProv]);

  const allItems = useMemo(() => {
    const ids = new Set<string>();
    for (const m of months) for (const l of m.items) ids.add(l.item_id);
    return [...ids].map((id) => ({ id, name: names.item(id) })).sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [months, names, lang]);

  const units = parts.reduce((s, p) => s + p.units + p.provUnits, 0);
  const provUnits = parts.reduce((s, p) => s + p.provUnits, 0);
  const net = parts.reduce((s, p) => s + p.net + p.provNet, 0);
  const provNet = parts.reduce((s, p) => s + p.provNet, 0);
  const finals = parts.filter((p) => p.units || p.net);
  const gross = sumKnown(finals.map((p) => p.gross));
  const discount = sumKnown(finals.map((p) => p.discount));
  const gp = sumKnown(finals.map((p) => p.gp));
  const payable = sumKnown(finals.map((p) => p.payable));
  const received = products.size ? null : months.filter((m) => chosen.has(m.month.slice(0, 7))).reduce((s, m) => s + n0(m.received), 0);
  const baht = (v: number) => fmt(t.baht, { n: money(v) });

  const byItem = useMemo(() => {
    const map = new Map<string, { item: string; units: number; provUnits: number; net: number; provNet: number; gp: number | null; payable: number | null; states: Set<MonthState> }>();
    for (const p of parts) {
      const r = map.get(p.item) ?? { item: p.item, units: 0, provUnits: 0, net: 0, provNet: 0, gp: null, payable: null, states: new Set() };
      r.units += p.units; r.provUnits += p.provUnits; r.net += p.net; r.provNet += p.provNet;
      if (p.gp != null) r.gp = n0(r.gp) + p.gp;
      if (p.payable != null) r.payable = n0(r.payable) + p.payable;
      r.states.add(p.provUnits || p.provNet ? "provisional" : p.state);
      map.set(p.item, r);
    }
    return [...map.values()];
  }, [parts]);
  const top = [...byItem].sort((a, b) => measure === "units" ? b.units + b.provUnits - a.units - a.provUnits : b.net + b.provNet - a.net - a.provNet).slice(0, 8);
  const monthRows = months.filter((m) => chosen.has(m.month.slice(0, 7))).map((m) => {
    const ps = parts.filter((p) => p.month === m.month.slice(0, 7));
    return {
      month: m.month.slice(0, 7), state: m.state,
      final: ps.reduce((s, p) => s + (measure === "units" ? p.units : p.net), 0),
      prov: ps.reduce((s, p) => s + (measure === "units" ? p.provUnits : p.provNet), 0),
    };
  });

  const toggleMonth = (m: string) => {
    const next = new Set(chosen);
    if (next.has(m)) next.delete(m); else next.add(m);
    setPicked(next);
  };
  const monthsText = chosen.size ? [...chosen].sort().map((m) => monthLabel(lang, m, "short")).join(", ") : t.ics.noMonths;
  const productsText = products.size ? fmt(t.ics.nProducts, { n: products.size }) : t.ics.allProducts;

  const download = () => {
    const x = opsText[exportLang].ics;
    const name = (id: string) => {
      const i = ref.items.find((x) => x.id === id);
      return i ? `${exportLang === "th" ? i.name_th : i.name_en} (${i.code})` : id;
    };
    const head = [x.month, x.colProduct, x.provisionalLabel, x.colUnits, x.net, x.gp, x.afterGp, x.colStatus];
    const rows: (string | number | null)[][] = [head];
    for (const p of [...parts].sort((a, b) => a.month.localeCompare(b.month))) {
      if (p.units || p.net) rows.push([p.month, name(p.item), x.finalLabel, p.units, p.net, p.gp, p.payable, x.state[p.state]]);
      if (p.provUnits || p.provNet) rows.push([p.month, name(p.item), x.provisionalLabel, p.provUnits, p.provNet, null, null, x.state.provisional]);
    }
    rows.push([x.total, "", "", units, net, gp, payable, ""]);
    rows.push([]);
    rows.push([x.afterGpNote]);
    const csv = rows.map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `iconsiam-sales-${year}-${exportLang}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const years = Array.from({ length: thisYear - 2024 }, (_, i) => thisYear - i);

  return (
    <div className="ics__body">
      <div className="panel ics__filters">
        <div className="row">
          <Field label={t.ics.year}>{(id) => (
            <Select id={id} value={String(year)} onChange={(v) => { setYear(Number(v)); setPicked(null); }}
              options={years.map((y) => ({ value: String(y), label: lang === "th" ? String(y + 543) : String(y) }))} />
          )}</Field>
          <ProductPicker all={allItems} value={products} onChange={setProducts} />
          <label className="check"><input type="checkbox" checked={withProv} onChange={(e) => { setWithProv(e.target.checked); setPicked(null); }} /> {t.ics.includeProvisional}</label>
        </div>
        <fieldset className="chips">
          <legend>{t.ics.months} <span className="muted small">· {t.ics.monthsHint}</span></legend>
          <div className="chips__row">
            {Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).filter((m) => m <= to.slice(0, 7)).map((m) => {
              const st = months.find((x) => x.month.slice(0, 7) === m)?.state ?? "open";
              return (
                <button key={m} type="button" className={`chip-btn chip-btn--${st}`} aria-pressed={chosen.has(m)} onClick={() => toggleMonth(m)}
                  title={t.ics.stateHint[st]}>
                  {monthLabel(lang, m, "short")}<span className="sr-only"> · {t.ics.state[st]}</span>
                </button>
              );
            })}
          </div>
          <div className="row">
            <button type="button" className="link" onClick={() => setPicked(new Set(withData))}>{t.ics.allMonths}</button>
            <button type="button" className="link" onClick={() => setPicked(new Set())}>{t.ics.clearMonths}</button>
          </div>
        </fieldset>
        <p className="ics__selection" aria-live="polite">
          {fmt(t.ics.selection, { months: monthsText, products: productsText, mode: withProv ? t.ics.modeAll : t.ics.modeFinal })}
        </p>
      </div>

      {rep.error ? <Notice kind="error">{errorText(t, rep.error)}</Notice> : !rep.data ? <p>{t.loading}</p> : (
        <>
          <div className="ics__cards">
            <KCard icon="cart" label={t.ics.units} value={units} format={qty} sub={provUnits ? fmt(t.ics.unitsSub, { n: qty(provUnits) }) : undefined} prov={provUnits > 0} />
            <KCard icon="chart" label={t.ics.net} value={net} format={baht} sub={provNet ? `${t.ics.provisionalLabel} ${baht(provNet)}` : undefined} prov={provNet > 0} />
            <KCard icon="alert" label={t.ics.gp} value={gp} format={baht} missing={t.ics.notSupplied} sub={withProv && provUnits ? t.ics.gpProvisional : undefined} />
            <KCard icon="cash" label={t.ics.afterGp} value={payable} format={baht} missing={t.ics.notSupplied} sub={t.ics.afterGpNote} />
          </div>

          {!parts.length ? <p className="panel muted">{t.ics.empty}</p> : (
            <div className="ics__grid">
              <section className="panel">
                <div className="row row--between">
                  <h2>{t.ics.monthlyChart}</h2>
                  <div className="row">
                    <Measure value={measure} onChange={setMeasure} />
                    <button type="button" className="btn btn--small" onClick={() => setReplay((n) => n + 1)}><Icon name="replay" size={18} /> {t.ics.replay}</button>
                  </div>
                </div>
                <MonthBars key={`m${replay}${measure}`} rows={monthRows} fmtV={measure === "units" ? qty : (v) => money(v)} />
                <p className="dash__note">{t.ics.chartNote}</p>
              </section>
              <section className="panel">
                <h2>{t.ics.topProducts}</h2>
                <ul className="ibars" key={`t${replay}${measure}`} aria-label={t.ics.topProducts}>
                  {(() => {
                    const max = Math.max(1, ...top.map((r) => measure === "units" ? r.units + r.provUnits : r.net + r.provNet));
                    return top.map((r, i) => {
                      const f = measure === "units" ? r.units : r.net, pv = measure === "units" ? r.provUnits : r.provNet;
                      return (
                        <li key={r.item} style={{ ["--i" as string]: i }}>
                          <span className="ibars__label">{names.item(r.item)}</span>
                          <span className="ibars__track" aria-hidden="true">
                            <span className="ibars__bar" style={{ width: `${(f / max) * 100}%` }} />
                            {pv > 0 && <span className="ibars__bar ibars__bar--prov" style={{ width: `${(pv / max) * 100}%` }} />}
                          </span>
                          <span className="ibars__value">{measure === "units" ? qty(f + pv) : baht(f + pv)}{pv > 0 && <small> · {t.ics.provisionalLabel} {measure === "units" ? qty(pv) : money(pv)}</small>}</span>
                        </li>
                      );
                    });
                  })()}
                </ul>
              </section>
            </div>
          )}

          <section className="panel">
            <h2>{t.ics.productTable}</h2>
            <div className="scroll">
              <table className="table ics__table">
                <thead><tr>
                  <th>{t.ics.colProduct}</th><th className="n">{t.ics.colUnits}</th><th className="n">{t.ics.net}</th>
                  <th className="n">{t.ics.gp}</th><th className="n">{t.ics.afterGp}</th><th>{t.ics.colStatus}</th>
                </tr></thead>
                <tbody>
                  {byItem.sort((a, b) => b.net + b.provNet - a.net - a.provNet).map((r) => (
                    <tr key={r.item}>
                      <td data-label={t.ics.colProduct}>{names.item(r.item)}</td>
                      <td className="n" data-label={t.ics.colUnits}>{qty(r.units + r.provUnits)}{r.provUnits > 0 && <small className="prov-note"> ({t.ics.provisionalLabel} {qty(r.provUnits)})</small>}</td>
                      <td className="n" data-label={t.ics.net}>{money(r.net + r.provNet)}</td>
                      <td className="n" data-label={t.ics.gp}>{r.gp == null ? <span className="missing">{t.ics.notSupplied}</span> : money(r.gp)}</td>
                      <td className="n" data-label={t.ics.afterGp}>{r.payable == null ? <span className="missing">{t.ics.notSupplied}</span> : money(r.payable)}</td>
                      <td data-label={t.ics.colStatus}>{[...r.states].map((s) => <MonthStateBadge key={s} state={s} />)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr>
                  <th>{t.ics.total}</th><th className="n">{qty(units)}</th><th className="n">{money(net)}</th>
                  <th className="n">{gp == null ? "–" : money(gp)}</th><th className="n">{payable == null ? "–" : money(payable)}</th><th />
                </tr></tfoot>
              </table>
            </div>
            <dl className="ics__money">
              <div><dt>{t.ics.gross}</dt><dd>{gross == null ? <span className="missing">{t.ics.notSupplied}</span> : baht(gross)}</dd></div>
              <div><dt>{t.ics.discounts}</dt><dd>{discount == null ? <span className="missing">{t.ics.notSupplied}</span> : baht(discount)}</dd></div>
              <div><dt>{t.ics.returns}</dt><dd><span className="missing">{t.ics.notSupplied}</span></dd></div>
              <div><dt>{t.ics.net}</dt><dd>{baht(net)}</dd></div>
              <div><dt>{t.ics.gp}</dt><dd>{gp == null ? <span className="missing">{t.ics.notSupplied}</span> : baht(gp)}</dd></div>
              <div><dt>{t.ics.afterGp}</dt><dd>{payable == null ? <span className="missing">{t.ics.notSupplied}</span> : baht(payable)}</dd></div>
              <div><dt>{t.ics.received}</dt><dd>{received == null ? <span className="missing">{t.ics.allProducts}</span> : baht(received)}</dd></div>
            </dl>
            <p className="dash__note"><Icon name="alert" size={18} /> {t.ics.afterGpNote} {t.ics.costMissing}</p>
            <div className="row">
              <Field label={t.ics.exportLang}>{(id) => (
                <Select id={id} value={exportLang} onChange={(v) => setExportLang(v as Lang)} options={[{ value: "th", label: t.icx.langTh }, { value: "en", label: t.icx.langEn }]} />
              )}</Field>
              <div className="field"><button type="button" className="btn" onClick={download} disabled={!parts.length}><Icon name="download" /> {t.ics.export}</button></div>
            </div>
          </section>

          <Sources months={months.filter((m) => chosen.has(m.month.slice(0, 7)) && m.updates.length)} />
        </>
      )}
    </div>
  );
}

function KCard({ icon, label, value, format, sub, missing, prov }: {
  icon: string; label: string; value: number | null; format: (n: number) => string; sub?: string; missing?: string; prov?: boolean;
}) {
  const { t } = useOps();
  return (
    <div className={value == null ? "kcard kcard--missing" : "kcard"}>
      <span className="kcard__icon"><Icon name={icon} size={22} /></span>
      <span className="kcard__label">{label}</span>
      <strong className="kcard__value"><Counter value={value} format={format} missing={<span className="missing">{missing ?? t.unknown}</span>} /></strong>
      {prov && <span className="mstate mstate--provisional">{t.ics.provisionalLabel}</span>}
      {sub && <span className="kcard__sub">{sub}</span>}
    </div>
  );
}

function Measure({ value, onChange }: { value: "units" | "net"; onChange: (v: "units" | "net") => void }) {
  const { t } = useOps();
  return (
    <div className="seg" role="group" aria-label={t.ics.monthlyChart}>
      <button type="button" aria-pressed={value === "units"} onClick={() => onChange("units")}>{t.ics.byUnits}</button>
      <button type="button" aria-pressed={value === "net"} onClick={() => onChange("net")}>{t.ics.byValue}</button>
    </div>
  );
}

/** Monthly columns: official figures solid, interim figures hatched on top. Never split into days. */
function MonthBars({ rows, fmtV }: { rows: { month: string; state: MonthState; final: number; prov: number }[]; fmtV: (n: number) => string }) {
  const { t, lang } = useOps();
  const max = Math.max(1, ...rows.map((r) => r.final + r.prov));
  return (
    <div className="mbars" role="list" aria-label={t.ics.monthlyChart}>
      {rows.map((r, i) => (
        <div key={r.month} role="listitem" className="mbars__col" style={{ ["--i" as string]: i }}>
          <span className="mbars__value">{r.final + r.prov > 0 ? fmtV(r.final + r.prov) : ""}</span>
          <span className="mbars__plot" aria-hidden="true">
            <span className="mbars__stack" style={{ height: `${((r.final + r.prov) / max) * 100}%` }}>
              {r.prov > 0 && <span className="mbars__prov" style={{ flexGrow: r.prov }} />}
              {r.final > 0 && <span className="mbars__final" style={{ flexGrow: r.final }} />}
            </span>
          </span>
          <span className="mbars__label">{monthLabel(lang, r.month, "short")}</span>
          <span className="sr-only">{fmt(t.ics.chartSummary, { month: monthLabel(lang, r.month), final: fmtV(r.final), prov: fmtV(r.prov) })}</span>
        </div>
      ))}
    </div>
  );
}

function ProductPicker({ all, value, onChange }: { all: { id: string; name: string }[]; value: Set<string>; onChange: (s: Set<string>) => void }) {
  const { t } = useOps();
  return (
    <details className="picker">
      <summary><span className="picker__label">{t.ics.products}</span> <span>{value.size ? fmt(t.ics.nProducts, { n: value.size }) : t.ics.allProducts}</span></summary>
      <div className="picker__list">
        <label className="check"><input type="checkbox" checked={!value.size} onChange={() => onChange(new Set())} /> {t.ics.allProducts}</label>
        {all.map((p) => (
          <label key={p.id} className="check">
            <input type="checkbox" checked={value.has(p.id)} onChange={(e) => {
              const next = new Set(value);
              if (e.target.checked) next.add(p.id); else next.delete(p.id);
              onChange(next);
            }} /> {p.name}
          </label>
        ))}
      </div>
    </details>
  );
}

function Sources({ months }: { months: SalesMonth[] }) {
  const { t, lang } = useOps();
  if (!months.length) return null;
  return (
    <section className="panel">
      <h2>{t.ics.sources}</h2>
      <ul className="sources">
        {months.map((m) => (
          <li key={m.month}>
            <div className="row"><strong>{monthLabel(lang, m.month)}</strong><MonthStateBadge state={m.state} />
              {m.through && <span className="muted small">{fmt(t.ics.dataThrough, { date: dateLabel(lang, m.through) })}</span>}</div>
            <ul className="plain small">
              {m.updates.map((u) => (
                <li key={u.id} className={u.status === "superseded" ? "src src--old" : "src"}>
                  <strong>{t.ics.sourceKind[u.kind]}</strong>
                  {u.kind === "final" && <> · {fmt(t.ics.version, { n: u.version })}</>}
                  {" · "}{fmt(t.ics.coverage, { from: dateLabel(lang, u.coverage_start), to: dateLabel(lang, u.coverage_end) })}
                  {" · "}{fmt(t.ics.asOf, { date: dateLabel(lang, u.as_of) })}
                  {" · "}{u.totals.units != null ? `${qty(u.totals.units)} · ${fmt(t.baht, { n: money(u.totals.net) })}` : ""}
                  {u.status === "superseded" && <span className="mstate mstate--old">{t.ics.supersededLabel}</span>}
                  {u.doc_id && <> · <a href={`#/record/${u.doc_id}`}>{t.ics.details}</a></>}
                  <span className="muted mono src__ref">{u.source_ref}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
