// Small, dependency-free charts for the operations app. Single-series bars in ocean blue;
// deductions in amber (the pair passed the colour-blind and contrast checks on white).
// Values sit at the bar tips in text colours; every bar also has a hover tooltip (title), and
// the Business Report repeats the same numbers as tables.
import { useState } from "react";

export interface BarRow { key: string; label: string; value: number; display: string; short?: string; sub?: string; full?: string }

/** Horizontal bars, one series, sorted by the caller. */
export function HBars({ rows, caption }: { rows: BarRow[]; caption: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <ul className="hbars" aria-label={caption}>
      {rows.map((r) => (
        <li key={r.key} className="hbars__row" title={`${r.label}: ${r.display}`}>
          <span className="hbars__label">{r.label}{r.sub && <span className="muted"> · {r.sub}</span>}</span>
          <span className="hbars__track">
            <span className="hbars__bar" style={{ width: max > 0 ? `max(${(r.value / max) * 100}%, 2px)` : 0 }} aria-hidden="true" />
            <span className="hbars__value">{r.display}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Monthly columns. Only the highlighted month carries a value label; the rest show on hover. */
export function Columns({ rows, highlight, caption }: { rows: BarRow[]; highlight?: string; caption: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  const [hover, setHover] = useState<string | null>(null);
  const shown = hover ?? highlight;
  return (
    <div className="cols" role="list" aria-label={caption}>
      {rows.map((r) => (
        <div key={r.key} role="listitem" className={r.key === highlight ? "cols__col cols__col--on" : "cols__col"}
          title={`${r.full ?? r.label}: ${r.display}`} onMouseEnter={() => setHover(r.key)} onMouseLeave={() => setHover(null)}>
          <span className="cols__value" aria-hidden={r.key !== shown}>{r.key === shown || (r.value === max && r.value > 0) ? r.short ?? r.display : ""}</span>
          <span className="cols__plot">
            <span className="cols__bar" style={{ height: max > 0 && r.value > 0 ? `max(${(r.value / max) * 100}%, 2px)` : 0 }} aria-hidden="true" />
          </span>
          <span className="cols__label">{r.label}</span>
          <span className="sr-only">{r.full ?? r.label}: {r.display}</span>
        </div>
      ))}
    </div>
  );
}

/** Sales → minus channel deductions → what is left, as three aligned bars. */
export function Breakdown({ sales, deductions, after, labels }: {
  sales: number; deductions: number; after: number;
  labels: { sales: string; deductions: string; after: string; fmt: (n: number) => string };
}) {
  const pct = (n: number) => (sales > 0 ? `${Math.max((n / sales) * 100, n > 0 ? 0.5 : 0)}%` : "0");
  return (
    <dl className="flow">
      <div className="flow__row">
        <dt>{labels.sales}</dt>
        <dd><span className="flow__bar flow__bar--sales" style={{ width: "100%" }} aria-hidden="true" /><strong>{labels.fmt(sales)}</strong></dd>
      </div>
      <div className="flow__row">
        <dt>− {labels.deductions}</dt>
        <dd><span className="flow__bar flow__bar--minus" style={{ width: pct(deductions), marginLeft: pct(after) }} aria-hidden="true" /><strong>− {labels.fmt(deductions)}</strong></dd>
      </div>
      <div className="flow__row flow__row--total">
        <dt>= {labels.after}</dt>
        <dd><span className="flow__bar flow__bar--after" style={{ width: pct(after) }} aria-hidden="true" /><strong>{labels.fmt(after)}</strong></dd>
      </div>
    </dl>
  );
}

export interface LinkBarRow extends BarRow { href: string; linkLabel: string }

/**
 * Horizontal bars that open the matching records. Measured rows share one zero baseline and
 * scale to the largest value; rows without data (`missing`) show a text label and no bar, so
 * they can never be mistaken for a small measured value.
 */
export function LinkBars({ rows, missing = [], caption, missingLabel }: {
  rows: LinkBarRow[]; missing?: { key: string; label: string }[]; caption: string; missingLabel: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <ul className="lbars" aria-label={caption}>
      {rows.map((r) => (
        <li key={r.key}>
          <a className="lbars__row" href={r.href} title={`${r.label}: ${r.display}${r.sub ? ` · ${r.sub}` : ""}`} aria-label={`${r.label}: ${r.display}${r.sub ? `, ${r.sub}` : ""}. ${r.linkLabel}`}>
            <span className="lbars__label">{r.label}</span>
            <span className="lbars__track" aria-hidden="true">
              <span className="lbars__bar" style={{ width: max > 0 ? `max(${(r.value / max) * 100}%, 3px)` : 0 }} />
            </span>
            <span className="lbars__value">{r.display}{r.sub && <small>{r.sub}</small>}</span>
          </a>
        </li>
      ))}
      {missing.map((m) => (
        <li key={m.key} className="lbars__row lbars__row--missing">
          <span className="lbars__label">{m.label}</span>
          <span className="lbars__none">{missingLabel}</span>
        </li>
      ))}
    </ul>
  );
}

export interface SettleRow {
  key: string; label: string; href: string; net: number; deducted: number; after: number;
  netText: string; deductedText: string; afterText: string; notes: string[]; summary: string;
}

/** Per channel: sales split into what the channel keeps (GP/fees) and what is left to be paid. */
export function SettleBars({ rows, labels }: { rows: SettleRow[]; labels: { after: string; deductions: string } }) {
  const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
  return (
    <ul className="settle">
      {rows.map((r) => {
        const a = pct(r.after, r.net), d = r.net > 0 ? 100 - a : 0;
        return (
          <li key={r.key}>
            <a className="settle__row" href={r.href} title={r.summary} aria-label={r.summary}>
              <span className="settle__head"><strong>{r.label}</strong><span>{r.netText}</span></span>
              <span className="settle__bar" aria-hidden="true">
                {a > 0 && <span className="settle__after" style={{ width: `${a}%` }}>{a >= 12 ? `${a}%` : ""}</span>}
                {d > 0 && <span className="settle__minus" style={{ width: `${d}%` }}>{d >= 12 ? `${d}%` : ""}</span>}
              </span>
              <span className="settle__legend">
                <span><i className="sw sw--after" aria-hidden="true" />{labels.after} <strong>{r.afterText}</strong></span>
                <span><i className="sw sw--minus" aria-hidden="true" />{labels.deductions} <strong>{r.deductedText}</strong></span>
              </span>
              {r.notes.map((n) => <span key={n} className="settle__note">{n}</span>)}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
