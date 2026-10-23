// Business Report: the detailed figures behind the Overview, for any date range and channel.
// Every number comes from business_report() and links back to the records it was built from.
// Missing data is labelled, never shown as zero. CSV download of the same tables.
import { useState, type ReactNode } from "react";
import { businessReport, db, errorText, fmt, money, qty, today, useQuery, type BusinessReportData, type DocLine } from "./api";
import { HBars } from "./charts";
import { Field, Notice, Select, useNames, useOps } from "./ui";

export function BusinessReport() {
  const { t, ref, lang } = useOps();
  const names = useNames();
  const [from, setFrom] = useState(`${today().slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today());
  const [channel, setChannel] = useState("");
  const rep = useQuery<BusinessReportData>(() => businessReport(from, to, channel), [from, to, channel]);
  const r = rep.data;
  const baht = (n: number | null | undefined) => fmt(t.baht, { n: money(n) });
  const missing = <span className="missing">{t.rep.missing}</span>;

  const summary: [string, ReactNode, string?][] = r ? [
    [t.rep.grossSales, baht(r.gross_sales)],
    [t.rep.discounts, r.discounts ? `− ${baht(r.discounts)}` : baht(0)],
    [fmt(t.rep.returns, { n: r.returns.count }), r.returns.count ? baht(r.returns.amount) : baht(0), "muted"],
    [t.rep.netSales, baht(r.net_sales), "strong"],
    [t.rep.units, qty(r.units)],
    [t.rep.gp, `− ${baht(r.gp)}`],
    [t.rep.fees, r.fees_complete ? `− ${baht(r.settled_fees)}` : <>{`− ${baht(r.settled_fees)}`} <span className="missing">{fmt(t.ov.attnFees, { n: r.fees_unknown_orders })}</span></>],
    [t.rep.afterChannel, baht(r.after_channel), "strong"],
    [t.rep.expected, baht(r.receivable.expected)],
    [t.rep.received, baht(r.receivable.received)],
    [t.rep.unsettled, baht(r.receivable.open)],
    [t.rep.cashReceived, baht(r.cash_received)],
    [t.rep.cogs, r.cogs != null ? `− ${baht(r.cogs)}` : <>{missing} <span className="muted">({fmt(t.rep.missingCosts, { n: r.cogs_unknown_lines })})</span></>],
    [t.rep.expenses, channel ? missing : `− ${baht(r.expenses)}`],
    [t.rep.advertising, channel ? missing : `− ${baht(r.advertising)}`],
    [t.rep.profit, r.profit != null ? <>{baht(r.profit)}{r.profit_provisional && <><br /><span className="missing">{t.ov.profitProvisional}</span></>}</> : missing, "strong"],
  ] : [];

  const download = () => {
    if (!r) return;
    const rows: (string | number)[][] = [
      ["section", "name", "units", "net_sales_thb"],
      ...r.by_channel.map((c) => ["channel", names.channel(c.channel), c.units, c.net]),
      ...r.by_product.map((p) => ["product", lang === "th" ? p.name_th : p.name_en, p.units, p.net]),
      ...r.by_month.map((m) => ["month", m.month, m.units, m.net]),
      [],
      ["record", "date", "channel", "report_no", "period_start", "period_end", "net_sales_thb", "gp_thb", "amount_due_thb", "received_thb", "receipt_status", "stock"],
      ...r.sources.map((s) => [s.doc_no, s.doc_date, names.channel(s.channel), s.report_no ?? "", s.period_start ?? "", s.period_end ?? "",
        s.net_sales, s.gp ?? "", s.amount_due ?? "", s.received ?? "", s.receipt_status, s.stock ?? ""]),
    ];
    const csv = rows.map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `balena-report-${from}-${to}${channel ? `-${channel}` : ""}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="report">
      <h1>{t.nav.report}</h1>
      <div className="filters">
        <Field label={t.rep.from}>{(id) => <input id={id} type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />}</Field>
        <Field label={t.rep.to}>{(id) => <input id={id} type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />}</Field>
        <Field label={t.rep.channel}>{(id) => <Select id={id} value={channel} onChange={setChannel} placeholder={t.rep.allChannels}
          options={ref.channels.map((c) => ({ value: c.code, label: c.name }))} />}</Field>
        <div className="field"><button type="button" className="btn" onClick={download} disabled={!r}>{t.rep.export}</button></div>
      </div>

      {rep.error ? <Notice kind="error">{errorText(t, rep.error)}</Notice> : !r ? <p>{t.loading}</p> : !r.has_records ? <p className="muted">{t.rep.noRows}</p> : (
        <>
          <div className="report__grid">
            <div className="panel">
              <h2>{t.rep.summary}</h2>
              <table className="table table--summary">
                <tbody>
                  {summary.map(([k, v, cls], i) => (
                    <tr key={i} className={cls}><th scope="row">{k}</th><td className="n">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel">
              <h2>{t.rep.byChannel}</h2>
              <HBars caption={t.rep.byChannel} rows={r.by_channel.map((c) => ({ key: c.channel, label: names.channel(c.channel), value: Number(c.net), display: baht(c.net), sub: fmt(t.ov.salesSub, { n: qty(c.units) }) }))} />
              <h2>{t.rep.byMonth}</h2>
              <table className="table">
                <thead><tr><th>{t.rep.month}</th><th className="n">{t.rep.units}</th><th className="n">{t.rep.netSales}</th></tr></thead>
                <tbody>{r.by_month.map((m) => <tr key={m.month}><td>{m.month}</td><td className="n">{qty(m.units)}</td><td className="n">{money(m.net)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h2>{t.rep.byProduct}</h2>
            <div className="scroll">
              <table className="table">
                <thead><tr><th>{t.f.product}</th><th className="n">{t.rep.units}</th><th className="n">{t.rep.netSales}</th></tr></thead>
                <tbody>
                  {r.by_product.map((p) => <tr key={p.item_id}><td>{lang === "th" ? p.name_th : p.name_en}</td><td className="n">{qty(p.units)}</td><td className="n">{money(p.net)}</td></tr>)}
                </tbody>
                <tfoot><tr><th>{t.f.total}</th><th className="n">{qty(r.units)}</th><th className="n">{money(r.net_sales)}</th></tr></tfoot>
              </table>
            </div>
          </div>

          <div className="panel">
            <h2>{t.rep.sources}</h2>
            <ul className="sources">
              {r.sources.map((s) => (
                <li key={s.id}>
                  <div className="row row--between">
                    <a href={`#/record/${s.id}`}><strong>{t.types[s.doc_type as "sale"]}</strong> <span className="mono">{s.doc_no}</span></a>
                    <span className={`pill pill--${s.receipt_status}`}><span aria-hidden="true">{s.receipt_status === "settled" || s.receipt_status === "paid_at_sale" ? "✓" : "!"}</span> {t.receipt[s.receipt_status]}</span>
                  </div>
                  <p className="muted small">
                    {[names.channel(s.channel), s.report_no && fmt(t.rep.reportNo, { no: s.report_no }), s.branch_name,
                      s.period_start && fmt(t.rep.period, { from: s.period_start, to: s.period_end }),
                      s.generated_at && fmt(t.rep.generated, { date: s.generated_at.slice(0, 10) }),
                      s.source?.file && fmt(t.rep.file, { file: s.source.file })].filter(Boolean).join(" · ")}
                  </p>
                  <p className="small">
                    {t.rep.netSales} {baht(s.net_sales)}
                    {s.gp != null && <> · {t.rep.gp} − {baht(s.gp)}</>}
                    {s.amount_due != null && <> · {t.rep.supplierAmount} {baht(s.amount_due)}</>}
                    {s.stock && <> · {t.stockStatus[s.stock as "deduct"] ?? s.stock}</>}
                  </p>
                  <SourceLines docId={s.id} />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

/** Expandable lines of one source record, loaded when opened. */
function SourceLines({ docId }: { docId: string }) {
  const { t } = useOps();
  const names = useNames();
  const [lines, setLines] = useState<DocLine[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  return (
    <details className="lines-detail" onToggle={(e) => {
      if ((e.target as HTMLDetailsElement).open && !lines) {
        db.from("doc_lines").select("*").eq("doc_id", docId).order("line_no").then(({ data, error }) => { if (error) setErr(error); else setLines(data as DocLine[]); });
      }
    }}>
      <summary>{t.rep.showLines}</summary>
      {err ? <Notice kind="error">{errorText(t, err)}</Notice> : !lines ? <p>{t.loading}</p> : (
        <div className="scroll">
          <table className="table">
            <thead><tr><th>{t.f.product}</th><th>{t.rep.itemCode}</th><th className="n">{t.f.qty}</th><th className="n">{t.f.unitPrice}</th><th className="n">{t.rep.netSales}</th><th className="n">{t.rep.supplierAmount}</th></tr></thead>
            <tbody>
              {lines.map((l) => {
                const x = l.extra as Record<string, string | number | undefined>;
                return (
                  <tr key={l.id}>
                    <td>{names.item(l.item_id)}{x.source_name ? <><br /><span className="muted small">{t.rep.sourceName}: {x.source_name}</span></> : null}</td>
                    <td className="mono">{x.item_code ?? ""}</td>
                    <td className="n">{qty(l.qty)}</td>
                    <td className="n">{money(l.unit_price)}</td>
                    <td className="n">{money(l.amount)}</td>
                    <td className="n">{x.supplier_amount != null ? money(Number(x.supplier_amount)) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
