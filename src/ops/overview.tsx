// Overview: one month at a glance. Four cards, the sales → deductions → amount-left breakdown,
// three compact charts and a short "needs attention" list. Detailed figures live in the
// Business Report. Every number comes from business_report(); missing data is shown as
// "incomplete", never as zero.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { addMonths, businessReport, errorText, fmt, money, monthRange, qty, seesMoney, today, useQuery, type BusinessReportData } from "./api";
import { Breakdown, Columns, HBars } from "./charts";
import { Field, Notice, useNames, useOps } from "./ui";

export function Overview() {
  const { t, ref, lang } = useOps();
  const names = useNames();
  const money_ = seesMoney(ref.me.role);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [measure, setMeasure] = useState<"units" | "net">("units");
  const chosen = useRef(false);
  const { from, to } = monthRange(month);
  const rep = useQuery<BusinessReportData>(() => businessReport(from, to), [from, to]);
  const trend = useQuery<BusinessReportData>(() => businessReport(monthRange(addMonths(month, -5)).from, to), [month]);
  const r = rep.data;

  // Open on the latest month that has sales, unless the user has picked a month.
  useEffect(() => {
    if (chosen.current || !r || r.has_records || !r.latest_sales_date) return;
    chosen.current = true;
    setMonth(r.latest_sales_date.slice(0, 7));
  }, [r]);

  const baht = (n: number | null | undefined) => fmt(t.baht, { n: money(n) });
  if (!money_) return <section><h1>{t.nav.home}</h1><p className="muted">{t.home.staffNote}</p><QuickActions /></section>;

  const status: "actual" | "incomplete" | "empty" = !r ? "empty" : !r.has_records ? "empty"
    : (!r.cogs_complete || !r.fees_complete || r.stock_unreconciled > 0 || !r.opening_posted || r.negative_stock > 0 || r.profit_provisional) ? "incomplete" : "actual";
  const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { month: "short" });

  const attention: { key: string; text: string; href: string }[] = r ? [
    r.receivable.unconfirmed_count > 0 && { key: "receipt", text: fmt(t.ov.attnReceipt, { n: r.receivable.unconfirmed_count, amount: baht(r.receivable.unconfirmed_amount) }), href: "#/report" },
    r.cogs_unknown_lines > 0 && { key: "costs", text: fmt(t.ov.attnCosts, { n: r.cogs_unknown_lines }), href: "#/report" },
    r.stock_unreconciled > 0 && { key: "stock", text: fmt(t.ov.attnStock, { n: r.stock_unreconciled }), href: "#/stock" },
    !r.opening_posted && { key: "opening", text: t.ov.attnOpening, href: "#/new/opening" },
    r.fees_unknown_orders > 0 && { key: "fees", text: fmt(t.ov.attnFees, { n: r.fees_unknown_orders }), href: "#/report" },
    r.negative_stock > 0 && { key: "negative", text: fmt(t.ov.attnNegative, { n: r.negative_stock }), href: "#/stock" },
    r.batches_pending > 0 && { key: "batches", text: fmt(t.ov.attnBatches, { n: r.batches_pending }), href: "#/records" },
    r.pending_approvals > 0 && { key: "approvals", text: fmt(t.ov.attnApprovals, { n: r.pending_approvals }), href: "#/approvals" },
    r.low_stock > 0 && { key: "low", text: fmt(t.ov.attnLowStock, { n: r.low_stock }), href: "#/stock" },
  ].filter(Boolean) as { key: string; text: string; href: string }[] : [];

  const profitWhy = r ? r.profit_missing.map((m) => (m === "costs" ? t.ov.whyProfit : m === "fees" ? t.ov.whyFees : t.ov.whyChannel)) : [];
  const receiptState = r && r.receivable.expected > 0
    ? (r.receivable.open === 0 ? t.receipt.settled : r.receivable.received > 0 ? t.receipt.partly_received : t.receipt.unconfirmed) : null;

  const compact = new Intl.NumberFormat(lang === "th" ? "th-TH" : "en-US", { notation: "compact", maximumFractionDigits: 1 });
  const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5));
  const trendRows = months.map((m) => {
    const v = Number(trend.data?.by_month.find((x) => x.month === m)?.net ?? 0);
    return { key: m, label: monthLabel(m), value: v, full: `${monthLabel(m)} ${m.slice(0, 4)}`, display: baht(v), short: compact.format(v) };
  });

  return (
    <section className="ov">
      <div className="ov__head">
        <h1>{t.nav.home}</h1>
        <Field label={t.ov.period}>{(id) => (
          <input id={id} type="month" value={month} max={today().slice(0, 7)}
            onChange={(e) => { if (e.target.value) { chosen.current = true; setMonth(e.target.value); } }} />
        )}</Field>
      </div>

      {rep.error ? <Notice kind="error">{errorText(t, rep.error)}</Notice> : !r ? <p>{t.loading}</p> : (
        <>
          <p className={`state state--${status}`}>
            <span aria-hidden="true">{status === "actual" ? "✓" : status === "incomplete" ? "!" : "○"}</span>
            {t.status2[status]}
          </p>

          <div className="kpis">
            <Kpi label={t.ov.sales} value={r.has_records ? baht(r.net_sales) : null} sub={r.has_records ? fmt(t.ov.salesSub, { n: qty(r.units) }) : t.ov.noData} />
            <Kpi label={t.ov.profit} value={r.profit != null && r.has_records ? baht(r.profit) : null} sub={r.profit != null && r.profit_provisional ? t.ov.profitProvisional : undefined} why={profitWhy} incompleteLabel={t.ov.incomplete} moreLabel={t.ov.more} />
            <Kpi label={t.ov.cash} value={r.cash_balance != null ? baht(r.cash_balance) : null} why={r.opening_posted ? [] : [t.ov.whyCash]} incompleteLabel={t.ov.incomplete} moreLabel={t.ov.more} />
            <Kpi label={t.ov.awaiting} value={baht(r.receivable.open)} sub={receiptState ?? undefined} />
          </div>

          {r.has_records && (
            <div className="panel">
              <h2>{t.ov.breakdown}</h2>
              <Breakdown sales={Number(r.net_sales)} deductions={Number(r.gp) + Number(r.settled_fees)} after={Number(r.after_channel)}
                labels={{ sales: t.ov.sales, deductions: t.ov.deductions, after: t.ov.afterChannel, fmt: baht }} />
              {receiptState && <p className="flow__note"><span className="dot dot--warn" aria-hidden="true" />{receiptState}</p>}
              {r.profit == null && <p className="muted small">{t.ov.notProfit}</p>}
            </div>
          )}

          <div className="ov__grid">
            <div className="panel">
              <h2>{t.ov.byChannel}</h2>
              {r.by_channel.length ? (
                <HBars caption={t.ov.byChannel} rows={r.by_channel.map((c) => ({ key: c.channel, label: names.channel(c.channel), value: Number(c.net), display: baht(c.net), sub: fmt(t.ov.salesSub, { n: qty(c.units) }) }))} />
              ) : <p className="muted">{t.ov.noData}</p>}
            </div>
            <div className="panel">
              <h2>{t.ov.overTime}</h2>
              <Columns caption={t.ov.overTime} rows={trendRows} highlight={month} />
              <p className="muted small">{t.ov.overTimeNote}</p>
            </div>
            <div className="panel">
              <div className="row row--between">
                <h2>{t.ov.topProducts}</h2>
                <div className="seg" role="group" aria-label={t.ov.topProducts}>
                  <button type="button" aria-pressed={measure === "units"} onClick={() => setMeasure("units")}>{t.ov.byUnits}</button>
                  <button type="button" aria-pressed={measure === "net"} onClick={() => setMeasure("net")}>{t.ov.bySales}</button>
                </div>
              </div>
              {r.by_product.length ? (
                <HBars caption={`${t.ov.topProducts} · ${measure === "units" ? t.ov.byUnits : t.ov.bySales}`}
                  rows={[...r.by_product].sort((a, b) => Number(b[measure]) - Number(a[measure])).slice(0, 5).map((p) => ({
                    key: p.item_id, label: lang === "th" ? p.name_th : p.name_en, value: Number(p[measure]),
                    display: measure === "units" ? fmt(t.ov.salesSub, { n: qty(p.units) }) : baht(p.net),
                  }))} />
              ) : <p className="muted">{t.ov.noData}</p>}
            </div>
            <div className="panel">
              <h2>{t.ov.attention}</h2>
              {attention.length ? (
                <ul className="attn">
                  {attention.map((a) => <li key={a.key}><span className="dot dot--warn" aria-hidden="true" /><a href={a.href}>{a.text}</a></li>)}
                </ul>
              ) : <p className="muted">{t.ov.allClear}</p>}
            </div>
          </div>

          <p><a className="btn" href="#/report">{t.ov.fullReport} →</a></p>
        </>
      )}
      <QuickActions />
    </section>
  );
}

function Kpi({ label, value, sub, why = [], incompleteLabel, moreLabel }: {
  label: string; value: string | null; sub?: ReactNode; why?: string[]; incompleteLabel?: string; moreLabel?: string;
}) {
  return (
    <div className={value == null ? "kpi kpi--missing" : "kpi"}>
      <span className="kpi__label">{label}</span>
      {value != null ? <strong className="kpi__value">{value}</strong> : <strong className="kpi__value kpi__value--missing">{incompleteLabel}</strong>}
      {sub && <span className="kpi__sub">{sub}</span>}
      {value == null && why.length > 0 && (
        <details className="why">
          <summary>{moreLabel}</summary>
          {why.map((w) => <p key={w}>{w}</p>)}
        </details>
      )}
    </div>
  );
}

function QuickActions() {
  const { t } = useOps();
  return (
    <>
      <h2>{t.home.quick}</h2>
      <ul className="tiles tiles--compact">
        {(["sale", "production", "transfer", "count"] as const).map((k) => (
          <li key={k}><a className="tile" href={`#/new/${k}`}><strong>{t.types[k]}</strong></a></li>
        ))}
      </ul>
    </>
  );
}
