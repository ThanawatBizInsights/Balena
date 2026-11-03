// Stock baseline (opening count) and product allocation of official-report rows.
// Baseline: anyone on the team records the physical count by product at a location, with the date,
// time and who counted; only the owner confirms it. Until a confirmed baseline covers a product, the
// stock tab shows "Opening stock pending" and makes no stock claims. Confirming is a database step
// (confirm_stock_baseline): it posts a count at the count time, so only later movements apply.
// Allocation: the owner assigns event rows of a historical official report to products. The database
// records a new version with the same totals (allocate_report_rows); stock is never touched.
import { useMemo, useRef, useState } from "react";
import { db, errorText, fmt, ICS, money, newKey, qty, today, useQuery, type Baseline } from "./api";
import { Icon } from "./icons";
import { ProductThumb, useToast, useWiggle } from "./motion";
import { Field, Notice, NumberInput, Select, itemName, useOps } from "./ui";
import { dateLabel } from "./iconsiam";

function Back() {
  const { t } = useOps();
  return <p><a href="#/iconsiam?tab=stock">← {t.icb.back}</a></p>;
}

interface BaselineLine { baseline_id: string; item_id: string; qty: number }

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
const dateOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

export function BaselinePage() {
  const { t, ref, lang } = useOps();
  const root = useRef<HTMLElement>(null);
  useWiggle(root);
  const q = useQuery(async () => {
    const [b, l] = await Promise.all([
      db.from("stock_baselines").select("*").order("effective_at", { ascending: false }),
      db.from("stock_baseline_lines").select("*"),
    ]);
    if (b.error || l.error) return { data: null, error: b.error ?? l.error };
    return { data: { baselines: b.data as Baseline[], lines: l.data as BaselineLine[] }, error: null };
  }, []);
  const member = (id: string | null) => ref.members.find((m) => m.id === id)?.display_name ?? "–";
  const loc = (code: string) => {
    const l = ref.locations.find((x) => x.code === code);
    return l ? (lang === "th" ? l.name_th : l.name_en) : code;
  };

  return (
    <section className="ics" ref={root}>
      <Back />
      <h1>{t.icb.title}</h1>
      <p className="lead">{t.icb.intro}</p>
      <BaselineForm done={q.reload} />
      <section className="panel">
        <h2>{t.icb.list}</h2>
        {q.error ? <Notice kind="error">{errorText(t, q.error)}</Notice> : !q.data ? <p>{t.loading}</p>
          : !q.data.baselines.length ? <p className="muted">{t.icb.none}</p> : (
            <ul className="plain baselines">
              {q.data.baselines.map((b) => (
                <BaselineItem key={b.id} b={b} lines={q.data!.lines.filter((l) => l.baseline_id === b.id)} locName={loc(b.location_code)}
                  recorder={member(b.recorded_by)} reload={q.reload} />
              ))}
            </ul>
          )}
      </section>
    </section>
  );
}

function BaselineItem({ b, lines, locName, recorder, reload }: { b: Baseline; lines: BaselineLine[]; locName: string; recorder: string; reload: () => void }) {
  const { t, ref, lang } = useOps();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const canCancel = b.status === "draft" && (ref.isOwner || b.recorded_by === ref.me.id);
  const confirm = async () => {
    if (!window.confirm(t.icb.confirmQ)) return;
    setBusy(true); setError(null);
    const { error: err } = await db.rpc("confirm_stock_baseline", { p_id: b.id });
    setBusy(false);
    if (err) setError(errorText(t, err)); else reload();
  };
  const cancel = async () => {
    setBusy(true); setError(null);
    const { error: err } = await db.rpc("cancel_stock_baseline", { p_id: b.id, p_reason: reason });
    setBusy(false);
    if (err) setError(errorText(t, err)); else reload();
  };
  const tone = b.status === "confirmed" ? "finalised" : b.status === "draft" ? "provisional" : "old";
  return (
    <li className="card baseline">
      <div className="row">
        <strong>{locName}</strong>
        <span className={`mstate mstate--${tone}`}>{t.icb.status[b.status]}</span>
        <span>{fmt(t.icb.effectiveAt, { date: dateLabel(lang, dateOf(b.effective_at)), time: timeOf(b.effective_at) })}</span>
      </div>
      <p className="small muted">
        {fmt(t.icb.by, { name: b.counted_by, recorder })} · {fmt(t.icb.items, { n: lines.length })}
        {b.confirmed_at && <> · {fmt(t.icb.confirmedBy, { date: dateLabel(lang, dateOf(b.confirmed_at)) })}</>}
      </p>
      {b.note && <p className="small">{b.note}</p>}
      <details>
        <summary>{t.icb.counted}</summary>
        <table className="table">
          <thead><tr><th>{t.icb.product}</th><th className="n">{t.icb.counted}</th></tr></thead>
          <tbody>
            {lines.map((l) => {
              const it = ref.items.find((i) => i.id === l.item_id);
              return <tr key={l.item_id}><td>{itemName(lang, it)}</td><td className="n">{qty(Number(l.qty))}</td></tr>;
            })}
          </tbody>
        </table>
      </details>
      {b.status === "draft" && (
        <div className="row">
          {ref.isOwner ? <button type="button" className="btn btn--primary" disabled={busy} onClick={confirm}><Icon name="check" /> {t.icb.confirm}</button>
            : <span className="muted small">{t.icb.ownerConfirms}</span>}
          {canCancel && !cancelling && <button type="button" className="btn" onClick={() => setCancelling(true)}>{t.icb.cancel}</button>}
        </div>
      )}
      {b.status === "draft" && ref.isOwner && <p className="small muted">{t.icb.confirmHint}</p>}
      {cancelling && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); cancel(); }}>
          <Field label={t.icb.cancelReason}>{(id) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} required />}</Field>
          <div className="field"><button className="btn" disabled={busy || !reason.trim()}>{t.icb.cancel}</button></div>
        </form>
      )}
      {error && <Notice kind="error">{error}</Notice>}
    </li>
  );
}

function BaselineForm({ done }: { done: () => void }) {
  const { t, ref, lang } = useOps();
  const locs = ref.locations.filter((l) => l.active && l.kind !== "transit");
  const [loc, setLoc] = useState<string>(ICS.location);
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("");
  const [countedBy, setCountedBy] = useState("");
  const [note, setNote] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const products = useMemo(() => ref.items.filter((i) => i.kind === "product" && i.active)
    .sort((a, b) => itemName(lang, a).localeCompare(itemName(lang, b), lang)), [ref.items, lang]);
  const filled = Object.entries(counts).filter(([, v]) => v.trim() !== "");

  const save = async () => {
    setBusy(true); setError(null);
    const { error: err } = await db.rpc("save_stock_baseline", { p: {
      client_key: key, location_code: loc, effective_at: `${date}T${time}:00+07:00`, counted_by: countedBy, note,
      lines: filled.map(([item_id, v]) => ({ item_id, qty: Number(v) })),
    } });
    setBusy(false);
    if (err) { setError(errorText(t, err)); return; }
    toast.show(t.icb.saved);
    setCounts({}); setNote(""); setKey(newKey());
    done();
  };

  return (
    <form className="card form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <h2>{t.icb.setup}</h2>
      <div className="grid">
        <Field label={t.icb.location}>{(id) => (
          <Select id={id} value={loc} onChange={setLoc} options={locs.map((l) => ({ value: l.code, label: lang === "th" ? l.name_th : l.name_en }))} />
        )}</Field>
        <Field label={t.icb.date}>{(id) => <input id={id} type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />}</Field>
        <Field label={t.icb.time}>{(id) => <input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} required />}</Field>
        <Field label={t.icb.countedBy}>{(id) => <input id={id} value={countedBy} onChange={(e) => setCountedBy(e.target.value)} required />}</Field>
        <Field label={t.icb.note} wide>{(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      </div>
      <fieldset className="lines">
        <legend>{t.icb.counted}</legend>
        <p className="small muted">{t.icb.onlyFilled}</p>
        <ul className="plain count-list">
          {products.map((i) => (
            <li key={i.id} className="count-row">
              <ProductThumb code={i.code} alt="" />
              <span className="count-row__name"><strong>{itemName(lang, i)}</strong><span className="muted small">{i.code}</span></span>
              <span className="count-row__input">
                <label className="sr-only" htmlFor={`bl-${i.id}`}>{t.icb.counted} {itemName(lang, i)}</label>
                <NumberInput id={`bl-${i.id}`} value={counts[i.id] ?? ""} step="1" placeholder={t.icb.counted} onChange={(v) => setCounts({ ...counts, [i.id]: v })} />
              </span>
            </li>
          ))}
        </ul>
      </fieldset>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row row--end">
        <span className="muted small">{fmt(t.icb.items, { n: filled.length })}</span>
        <button className="btn btn--primary" disabled={busy || !filled.length || !time || !countedBy.trim()}>{busy ? t.saving : t.icb.saveDraft}</button>
      </div>
      {toast.node}
    </form>
  );
}

// ---------- allocation of event rows ----------

interface ReportLine { line_no: number; item_id: string | null; qty: number; unit_price: number; amount: number; extra: Record<string, unknown> }

export function AllocatePage({ updateId }: { updateId: string }) {
  const { t, ref, lang } = useOps();
  const root = useRef<HTMLElement>(null);
  useWiggle(root);
  const q = useQuery(async () => {
    const u = await db.from("sales_updates").select("id, doc_id, version, status, coverage_start, coverage_end, source").eq("id", updateId).maybeSingle();
    if (u.error || !u.data) return { data: null, error: u.error ?? { message: "balena:not_found" } };
    const l = await db.from("doc_lines").select("line_no, item_id, qty, unit_price, amount, extra").eq("doc_id", u.data.doc_id).order("line_no");
    if (l.error) return { data: null, error: l.error };
    return { data: { update: u.data as { id: string; version: number; status: string; coverage_start: string; coverage_end: string }, lines: l.data as ReportLine[] }, error: null };
  }, [updateId]);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; version: number } | null>(null);
  const products = useMemo(() => ref.items.filter((i) => i.kind === "product")
    .sort((a, b) => itemName(lang, a).localeCompare(itemName(lang, b), lang)), [ref.items, lang]);

  if (!ref.isOwner) return <section className="ics"><Back /><p className="muted">{t.errors.owner_only}</p></section>;
  if (q.error) return <section className="ics"><Back /><Notice kind="error">{errorText(t, q.error)}</Notice></section>;
  if (!q.data) return <p>{t.loading}</p>;
  const pending = q.data.lines.filter((l) => l.item_id == null);
  const rowOf = (l: ReportLine) => String(l.extra.row ?? l.line_no);
  const chosen = Object.entries(pick).filter(([, v]) => v);

  const save = async () => {
    setBusy(true); setError(null);
    const { data, error: err } = await db.rpc("allocate_report_rows", { p: {
      update_id: updateId, note, allocations: chosen.map(([row, item_id]) => ({ row: Number(row), item_id })),
    } });
    setBusy(false);
    if (err) { setError(errorText(t, err)); return; }
    const u = (data as { update?: { id: string; version: number } }).update;
    if (u) setDone(u);
  };

  return (
    <section className="ics" ref={root}>
      <p><a href="#/iconsiam?tab=sales">← {t.icb.back}</a></p>
      <h1>{t.icb.allocTitle}</h1>
      <p className="lead">{t.icb.allocIntro}</p>
      <p><span className="mstate mstate--hist">{t.ics.historicalBadge}</span> {t.ics.historicalNote}</p>
      <p className="muted small">{dateLabel(lang, q.data.update.coverage_start)} – {dateLabel(lang, q.data.update.coverage_end)} · {fmt(t.ics.version, { n: q.data.update.version })}</p>
      {done ? <Notice kind="ok"><Icon name="check" size={18} /> {fmt(t.icb.allocDone, { v: done.version })} · <a href={`#/iconsiam/allocate/${done.id}`}>{t.icb.allocTitle}</a></Notice>
        : q.data.update.status !== "active" ? <Notice kind="info">{t.ics.supersededLabel}</Notice>
          : !pending.length ? <p className="muted">{t.icb.allocNone}</p> : (
            <form className="card form" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <fieldset className="lines">
                <legend>{t.icb.eventRows}</legend>
                <ul className="plain count-list">
                  {pending.map((l) => (
                    <li key={l.line_no} className="count-row count-row--alloc">
                      <span className="count-row__name">
                        <strong>{fmt(t.icb.row, { n: rowOf(l) })} · {String(l.extra.source_name ?? "")}</strong>
                        <span className="muted small">{t.ics.units} {qty(Number(l.qty))} · {t.icb.amount} {fmt(t.baht, { n: money(Number(l.amount)) })}</span>
                      </span>
                      <Field label={t.icb.product}>{(id) => (
                        <Select id={id} value={pick[rowOf(l)] ?? ""} onChange={(v) => setPick({ ...pick, [rowOf(l)]: v })}
                          options={[{ value: "", label: t.icb.leavePending }, ...products.map((i) => ({ value: i.id, label: `${itemName(lang, i)} (${i.code})` }))]} />
                      )}</Field>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <Field label={t.icb.allocNote} wide>{(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} required />}</Field>
              {error && <Notice kind="error">{error}</Notice>}
              <div className="row row--end">
                <button className="btn btn--primary" disabled={busy || !chosen.length || !note.trim()}>{busy ? t.saving : t.icb.allocSave}</button>
              </div>
            </form>
          )}
    </section>
  );
}
