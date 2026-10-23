// Overview: one month (and optionally one branch) at a glance, from overview_report().
// Four cards (sales, cash received, expenses, profit), sales by channel, sales to settlement,
// top products, needs attention, quick actions and recent activity. Every figure comes from
// recorded data; anything that can't be worked out says "no data" or "costs pending", never 0.
// Detailed accounting stays on the Business Report.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { errorText, fmt, money, monthRange, overviewReport, qty, seesMoney, today, useQuery, type OverviewData } from "./api";
import { LinkBars, SettleBars } from "./charts";
import { Field, Notice, Select, StatusBadge, useNames, useOps } from "./ui";

export function Overview() {
  const { t, ref, lang } = useOps();
  const names = useNames();
  const money_ = seesMoney(ref.me.role);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [loc, setLoc] = useState("");
  const [measure, setMeasure] = useState<"units" | "net">("units");
  const chosen = useRef(false);
  const { from, to } = monthRange(month);
  const rep = useQuery<OverviewData>(() => overviewReport(from, to, loc), [from, to, loc]);
  const r = rep.data;

  // Open on the latest month with sales when this month has nothing recorded at all.
  useEffect(() => {
    if (chosen.current || !r || r.has_records || r.cash_moves > 0 || r.recent.length || !r.latest_sales_date) return;
    chosen.current = true;
    setMonth(r.latest_sales_date.slice(0, 7));
  }, [r]);

  if (!money_) return <section><h1>{t.nav.home}</h1><p className="muted">{t.home.staffNote}</p><QuickActions /></section>;

  const baht = (n: number | null | undefined) => fmt(t.baht, { n: money(n) });
  const pct = (n: number, of: number) => `${of > 0 ? Math.round((n / of) * 100) : 0}%`;
  const branches = ref.locations.filter((l) => l.active && l.kind !== "transit");
  const branchName = loc ? names.loc(loc) : t.dash.allBranches;
  const monthText = new Date(`${month}-01T00:00:00`).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { month: "long", year: "numeric" });
  const q = (extra: Record<string, string>) => new URLSearchParams({ from, to, ...(loc ? { loc } : {}), ...extra }).toString();
  const reportHref = (channel?: string) => `#/report?${new URLSearchParams({ from, to, ...(channel ? { channel } : {}) })}`;

  return (
    <section className="dash">
      <header className="dash__head">
        <div>
          <h1>{t.dash.title}</h1>
          <p className="muted">{fmt(t.dash.showing, { month: monthText, branch: branchName })}</p>
        </div>
        <div className="dash__filters">
          <Field label={t.ov.period}>{(id) => (
            <input id={id} type="month" value={month} max={today().slice(0, 7)}
              onChange={(e) => { if (e.target.value) { chosen.current = true; setMonth(e.target.value); } }} />
          )}</Field>
          <Field label={t.dash.branch}>{(id) => (
            <Select id={id} value={loc} onChange={(v) => { chosen.current = true; setLoc(v); }} placeholder={t.dash.allBranches}
              options={branches.map((l) => ({ value: l.code, label: lang === "th" ? l.name_th : l.name_en }))} />
          )}</Field>
          <a className="btn btn--primary dash__new" href="#/new"><span aria-hidden="true">＋</span> {t.dash.newRecord}</a>
        </div>
      </header>

      {rep.error ? <Notice kind="error">{errorText(t, rep.error)}</Notice> : !r ? <p>{t.loading}</p> : (
        <Body r={r} baht={baht} pct={pct} q={q} reportHref={reportHref} measure={measure} setMeasure={setMeasure} />
      )}
    </section>
  );
}

function Body({ r, baht, pct, q, reportHref, measure, setMeasure }: {
  r: OverviewData; baht: (n: number | null | undefined) => string; pct: (n: number, of: number) => string;
  q: (extra: Record<string, string>) => string; reportHref: (channel?: string) => string;
  measure: "units" | "net"; setMeasure: (m: "units" | "net") => void;
}) {
  const { t, ref, lang } = useOps();
  const names = useNames();
  const net = Number(r.net_sales);

  // ---- profit card: a number only when every cost and fee is known ----
  const missing = r.profit_missing;
  const profitState: { value: string | null; badge?: string; sub?: string } =
    r.profit != null ? { value: baht(r.profit), sub: r.profit_provisional ? t.ov.profitProvisional : undefined }
      : missing.includes("branch_filter") ? { value: null, sub: t.dash.profitBranch }
        : missing.includes("no_sales") ? { value: null, sub: t.dash.noSales }
          : missing.includes("costs") ? { value: null, badge: t.dash.costsPending, sub: fmt(t.dash.costsPendingSub, { n: r.cogs_unknown_lines }) }
            : { value: null, badge: t.dash.feesPending, sub: fmt(t.ov.attnFees, { n: r.fees_unknown_orders }) };

  // ---- channels: measured rows, then active sales channels with no records ----
  const sold = new Set(r.by_channel.map((c) => c.channel));
  const channelRows = r.by_channel.map((c) => ({
    key: c.channel ?? "none", label: names.channel(c.channel), value: Number(c.net), display: baht(c.net),
    sub: fmt(t.ov.salesSub, { n: qty(c.units) }), href: reportHref(c.channel), linkLabel: fmt(t.dash.openRecords, { name: names.channel(c.channel) }),
  }));
  const noData = r.location ? [] : ref.channels.filter((c) => c.active && !sold.has(c.code)).map((c) => ({ key: c.code, label: c.name }));
  const top = r.by_channel[0];

  // ---- settlement: what each channel keeps vs. what is left to be paid ----
  const settle = r.by_channel.map((c) => {
    const deducted = Number(c.gp) + Number(c.fees);
    const after = Number(c.net) - deducted;
    const notes = [
      Number(c.due) > 0 ? fmt(t.dash.received, { received: baht(c.received), due: baht(c.due) }) : "",
      Number(c.paid_at_sale) > 0 ? fmt(t.dash.paidAtSale, { amount: baht(c.paid_at_sale) }) : "",
      Number(c.fees_unknown) > 0 ? fmt(t.dash.feesUnknown, { n: c.fees_unknown }) : "",
    ].filter(Boolean);
    return {
      key: c.channel ?? "none", label: names.channel(c.channel), href: reportHref(c.channel), net: Number(c.net), deducted, after,
      netText: baht(c.net), deductedText: baht(deducted), afterText: baht(after), notes,
      summary: fmt(t.dash.settlementSummary, { name: names.channel(c.channel), net: baht(c.net), deduct: baht(deducted), pct: pct(deducted, Number(c.net)), after: baht(after) }),
    };
  });

  // ---- products ----
  const products = [...r.by_product].sort((a, b) => Number(b[measure]) - Number(a[measure])).slice(0, 5).map((p) => ({
    key: p.item_id, label: lang === "th" ? p.name_th : p.name_en, value: Number(p[measure]),
    display: measure === "units" ? fmt(t.ov.salesSub, { n: qty(p.units) }) : baht(p.net),
    href: reportHref(), linkLabel: t.dash.fullReport,
  }));

  // ---- needs attention: only what the records support ----
  const a = r.attention;
  const attention: { key: string; tone: "warn" | "bad" | "info"; text: string; href: string; action: string }[] = [
    a.batches_pending > 0 && { key: "batches", tone: "warn", text: fmt(t.dash.attnBatches, { n: a.batches_pending }), href: `#/records?type=production&materials=pending${r.location ? `&loc=${r.location}` : ""}`, action: t.dash.view },
    a.negative_stock > 0 && { key: "negative", tone: "bad", text: fmt(t.dash.attnNegative, { n: a.negative_stock }), href: `#/stock?neg=1${r.location ? `&loc=${r.location}` : ""}`, action: t.dash.check },
    !a.opening_posted && { key: "opening", tone: "info", text: t.dash.attnOpening, href: "#/new/opening", action: t.dash.record },
    r.receivable.unconfirmed_count > 0 && { key: "receipt", tone: "warn", text: fmt(t.ov.attnReceipt, { n: r.receivable.unconfirmed_count, amount: baht(r.receivable.unconfirmed_amount) }), href: reportHref(), action: t.dash.view },
    r.cogs_unknown_lines > 0 && { key: "costs", tone: "warn", text: fmt(t.ov.attnCosts, { n: r.cogs_unknown_lines }), href: reportHref(), action: t.dash.view },
    a.stock_unreconciled > 0 && { key: "stock", tone: "info", text: fmt(t.ov.attnStock, { n: a.stock_unreconciled }), href: `#/records?${q({ type: "consignment" })}`, action: t.dash.view },
    a.pending_approvals > 0 && { key: "approvals", tone: "warn", text: fmt(t.ov.attnApprovals, { n: a.pending_approvals }), href: "#/approvals", action: t.dash.view },
  ].filter(Boolean) as { key: string; tone: "warn" | "bad" | "info"; text: string; href: string; action: string }[];

  const detail = (d: OverviewData["recent"][number]) => {
    if (d.reverses_doc) return t.dash.reversal;
    if (d.doc_type === "sale" || d.doc_type === "consignment") return names.channel(d.channel);
    if (d.doc_type === "purchase") return d.supplier ?? "–";
    if (d.doc_type === "expense") return [d.supplier, d.category && (t.categories as Record<string, string>)[d.category]].filter(Boolean).join(" · ") || "–";
    if (d.doc_type === "production") return d.materials === "pending" ? t.batch.pending : names.loc(d.location_code);
    if (d.doc_type === "payment") return t.dash.received_in;
    return names.loc(d.location_code);
  };

  return (
    <>
      <div className="dash__cards">
        <Card icon="cart" label={t.dash.sales} href={reportHref()}
          value={r.has_records ? baht(net) : null} missing={t.dash.noData}
          sub={r.has_records ? fmt(t.dash.salesSub, { n: qty(r.units) }) : t.dash.noSales} />
        <Card icon="cash" label={t.dash.cash} href={`#/records?${q({ type: "payment" })}`}
          value={baht(r.cash_received)} sub={r.cash_moves > 0 ? t.dash.cashSub : t.dash.cashNone} />
        <Card icon="receipt" label={t.dash.expenses} href={`#/records?${q({ type: "expense" })}`}
          value={r.expenses != null ? baht(r.expenses) : null} missing={t.dash.noData}
          sub={r.expenses != null
            ? <>{fmt(t.dash.expensesSub, { opex: baht(r.operating_expenses), ads: baht(r.advertising) })}{Number(r.purchases) > 0 && <><br />{fmt(t.dash.purchasesNote, { amount: baht(r.purchases) })}</>}</>
            : t.dash.expensesBranch} />
        <Card icon="chart" label={t.dash.profit} href={reportHref()}
          value={profitState.value} missing={profitState.badge ? "—" : t.dash.noData} badge={profitState.badge} sub={profitState.sub} />
      </div>

      <div className="dash__strip">
        <p>
          <span className="muted">{t.dash.balance}</span>{" "}
          {r.cash_balance != null ? <strong>{baht(r.cash_balance)}</strong> : <strong className="missing">{t.dash.noData}</strong>}
          <span className="muted small"> · {r.cash_balance != null ? t.dash.balanceNote : t.dash.balanceMissing}</span>
        </p>
        {Number(r.receivable.open) > 0 && <p><span className="muted">{t.dash.awaiting}</span> <strong>{baht(r.receivable.open)}</strong></p>}
      </div>

      <div className="dash__grid">
        <div className="panel">
          <h2>{t.dash.byChannel}</h2>
          {channelRows.length || noData.length ? (
            <LinkBars caption={t.dash.byChannel} rows={channelRows} missing={noData} missingLabel={t.dash.channelNoData} />
          ) : <p className="muted">{t.dash.noSales}</p>}
          {top && <p className="muted small">{fmt(t.dash.channelTop, { name: names.channel(top.channel), pct: pct(Number(top.net), net) })}</p>}
        </div>

        <div className="panel">
          <h2>{t.dash.settlement}</h2>
          {settle.length ? (
            <>
              <SettleBars rows={settle} labels={{ after: t.dash.afterGp, deductions: t.dash.deductions }} />
              <p className="dash__note"><span aria-hidden="true">ⓘ</span> {t.dash.notProfit}</p>
            </>
          ) : <p className="muted">{t.dash.noSales}</p>}
        </div>

        <div className="panel">
          <div className="row row--between">
            <h2>{t.dash.topProducts}</h2>
            <div className="seg" role="group" aria-label={t.dash.topProducts}>
              <button type="button" aria-pressed={measure === "units"} onClick={() => setMeasure("units")}>{t.ov.byUnits}</button>
              <button type="button" aria-pressed={measure === "net"} onClick={() => setMeasure("net")}>{t.ov.bySales}</button>
            </div>
          </div>
          {products.length ? (
            <LinkBars caption={`${t.dash.topProducts} · ${measure === "units" ? t.ov.byUnits : t.ov.bySales}`} rows={products} missingLabel={t.dash.noData} />
          ) : <p className="muted">{t.dash.noSales}</p>}
        </div>

        <div className="panel">
          <h2>{t.dash.attention}</h2>
          {attention.length ? (
            <ul className="alerts">
              {attention.map((x) => (
                <li key={x.key} className={`alert alert--${x.tone}`}>
                  <span className="alert__icon" aria-hidden="true">{x.tone === "bad" ? "!" : x.tone === "warn" ? "⚠" : "i"}</span>
                  <span className="alert__text">{x.text}</span>
                  <a className="btn btn--small" href={x.href} aria-label={`${x.action}: ${x.text}`}>{x.action} <span aria-hidden="true">›</span></a>
                </li>
              ))}
            </ul>
          ) : <p className="muted">{t.dash.allClear}</p>}
        </div>
      </div>

      <QuickActions />

      <div className="panel">
        <div className="row row--between">
          <h2>{t.dash.recent}</h2>
          <a href={reportHref()}>{t.dash.fullReport} →</a>
        </div>
        {r.recent.length ? (
          <table className="table recent">
            <thead>
              <tr><th>{t.dash.colDate}</th><th>{t.dash.colType}</th><th>{t.dash.colNo}</th><th>{t.dash.colDetail}</th><th className="n">{t.dash.colAmount}</th><th>{t.dash.colStatus}</th></tr>
            </thead>
            <tbody>
              {r.recent.map((d) => (
                <tr key={d.id}>
                  <td data-label={t.dash.colDate}>{d.doc_date}</td>
                  <td data-label={t.dash.colType}><span className={`type-pill type-pill--${d.doc_type}`}>{t.types[d.doc_type]}</span></td>
                  <td data-label={t.dash.colNo}><a className="mono" href={`#/record/${d.id}`}>{d.doc_no}</a></td>
                  <td data-label={t.dash.colDetail}>{detail(d)}</td>
                  <td data-label={t.dash.colAmount} className="n">{d.total != null ? baht(d.total) : "–"}</td>
                  <td data-label={t.dash.colStatus}><StatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">{t.dash.recentEmpty}</p>}
      </div>
    </>
  );
}

const ICONS: Record<string, ReactNode> = {
  cart: <path d="M3 4h2l2.4 10.2a1.5 1.5 0 0 0 1.5 1.1h8.3a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2M9.5 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01" />,
  cash: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 9.5v.01M17.5 14.5v.01" /></>,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h3" />,
  chart: <path d="M5 20V11M12 20V5M19 20v-6M3 20h18" />,
  sale: <path d="M3 4h2l2.4 10.2a1.5 1.5 0 0 0 1.5 1.1h8.3a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2M9.5 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01" />,
  production: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  purchase: <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3zM3 7.5 12 12l9-4.5M12 12v9" />,
  transfer: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  count: <path d="M9 4h6v3H9zM6 6h2M16 6h2M6 6v14h12V6M9 12l2 2 4-4" />,
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  );
}

function Card({ icon, label, value, missing, badge, sub, href }: {
  icon: string; label: string; value: string | null; missing?: string; badge?: string; sub?: ReactNode; href: string;
}) {
  return (
    <a className={`dcard dcard--${icon} ${value == null ? "dcard--missing" : ""}`} href={href}>
      <span className="dcard__icon"><Icon name={icon} /></span>
      <span className="dcard__body">
        <span className="dcard__label">{label}</span>
        {value != null ? <strong className="dcard__value">{value}</strong> : <strong className="dcard__value dcard__value--missing">{missing}</strong>}
        {badge && <span className="dcard__badge"><span aria-hidden="true">!</span> {badge}</span>}
        {sub && <span className="dcard__sub">{sub}</span>}
      </span>
    </a>
  );
}

function QuickActions() {
  const { t } = useOps();
  return (
    <nav className="quick" aria-label={t.dash.quick}>
      <h2 className="sr-only">{t.dash.quick}</h2>
      <ul>
        {(["sale", "production", "purchase", "transfer", "count"] as const).map((k) => (
          <li key={k}>
            <a className="quick__btn" href={`#/new/${k}`}>
              <span className="quick__icon"><Icon name={k} /></span>
              <strong>{t.types[k]}</strong>
              <span className="quick__arrow" aria-hidden="true">›</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
