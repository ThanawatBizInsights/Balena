// Add an ICONSIAM sales update (dated interval or month-to-date total). The wizard parses what was
// pasted or uploaded, matches each line to a product (our code, a confirmed store code, or the
// person's choice; never a barcode alone), and asks the database for a preview: the same commit
// run inside a rolled-back transaction. Nothing is saved until "Confirm and save"; the same
// duplicate-guard value never saves twice. Official monthly reports use the report form instead.
import { useRef, useState } from "react";
import { consignmentSales, db, errorText, fmt, ICS, money, monthRange, qty, today, type EffLine, type SalesUpdateRow } from "./api";
import { Icon } from "./icons";
import { useWiggle } from "./motion";
import { Field, Notice, Select, itemName, useOps } from "./ui";
import { dateLabel } from "./iconsiam";

type Kind = "interval" | "snapshot";
type Stage = "upload" | "parse" | "map" | "validate" | "save";
const STAGES: Stage[] = ["upload", "parse", "map", "validate", "save"];
interface Parsed { code: string; qty: number; net: number | null; description?: string }
interface Match { item_id: string | null; match: string; suggested?: string | null; issues?: string[]; candidates?: string[]; line: Record<string, unknown> }
interface Preview {
  ready: boolean; matches: Match[]; before?: EffLine[]; after?: EffLine[]; unchanged?: boolean;
  stock?: { item_id: string; diff: number; bucket: string; date: string }[]; error?: string; error_detail?: string;
}

/** CSV (code,qty,net with an optional header) or JSON {"lines":[{code,qty,net}]}. */
export function parseLines(text: string): Parsed[] {
  const s = text.trim();
  if (!s) return [];
  if (s.startsWith("{") || s.startsWith("[")) {
    const j = JSON.parse(s);
    const arr: Record<string, unknown>[] = Array.isArray(j) ? j : j.lines ?? [];
    return arr.map((l) => ({
      code: String(l.code ?? l.item_code ?? l.source_code ?? "").trim(), qty: Number(l.qty),
      net: l.net == null || l.net === "" ? null : Number(l.net), description: l.description ? String(l.description) : undefined,
    }));
  }
  const rows = s.split(/\r?\n/).map((r) => r.split(/[,\t;]/).map((c) => c.trim().replace(/^"|"$/g, ""))).filter((r) => r.some(Boolean));
  if (rows.length && isNaN(Number(rows[0][1]))) rows.shift(); // header
  return rows.map((r) => ({ code: r[0] ?? "", qty: Number(r[1]), net: r[2] == null || r[2] === "" ? null : Number(r[2].replace(/,/g, "")), description: r[3] || undefined }));
}

export function ImportWizard() {
  const { t, ref, lang } = useOps();
  const root = useRef<HTMLElement>(null);
  useWiggle(root);
  const now = today();
  const [kind, setKind] = useState<Kind>("snapshot");
  const [start, setStart] = useState(`${now.slice(0, 7)}-01`);
  const [end, setEnd] = useState(now);
  const [asOf, setAsOf] = useState(now);
  const [srcType, setSrcType] = useState("chat");
  const [reference, setReference] = useState("");
  const [guard, setGuard] = useState("");
  const [text, setText] = useState("");
  const [lines, setLines] = useState<Parsed[] | null>(null);
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [replaces, setReplaces] = useState<string[]>([]);
  const [intervals, setIntervals] = useState<SalesUpdateRow[]>([]);
  const [stage, setStage] = useState<Stage>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ unchanged: boolean } | null>(null);
  const products = ref.items.filter((i) => i.kind === "product");

  const cs = kind === "snapshot" ? `${asOf.slice(0, 7)}-01` : start;
  const ce = kind === "snapshot" ? asOf : end;
  const guardValue = guard.trim() || [ICS.channel, kind, cs, ce, asOf, reference.trim()].filter(Boolean).join("|");
  const reset = () => { setPreview(null); setSaved(null); setStage(lines ? "parse" : "upload"); };

  const payload = () => ({
    channel: ICS.channel, location_code: ICS.location, kind, coverage_start: cs, coverage_end: ce, as_of: asOf, source_ref: guardValue,
    source: { type: srcType, reference: reference.trim() || null, entered: "ops app" }, replaces,
    lines: (lines ?? []).map((l, i) => {
      const own = products.find((p) => p.code === l.code);
      const pick = chosen[i] || own?.id || null;
      return { source_code: own ? own.iconsiam_code : l.code, item_id: pick, qty: l.qty, net: l.net, description: l.description ?? null };
    }),
  });

  const doParse = (s: string) => {
    setError(null); setPreview(null); setSaved(null);
    try {
      const p = parseLines(s);
      if (!p.length) throw new Error("empty");
      if (p.some((l) => !l.code || !(l.qty >= 0))) throw new Error("bad");
      setLines(p); setChosen({}); setStage("parse");
    } catch { setLines(null); setStage("upload"); setError(t.ics.formatText); }
  };

  const runPreview = async () => {
    setBusy(true); setError(null); setStage("map");
    const { data, error: err } = await db.rpc("preview_sales_update", { p: payload() });
    setBusy(false);
    if (err) { setError(errorText(t, err)); return; }
    const pv = data as Preview;
    setPreview(pv);
    if (!pv.ready && !pv.error) return; // lines to choose
    setStage("validate");
    if (pv.error) {
      setError(errorText(t, { message: pv.error, details: pv.error_detail }));
      if (/overlap_conflict/.test(pv.error)) {
        const { data: s } = await consignmentSales(cs, cs);
        setIntervals((s?.months[0]?.updates ?? []).filter((u) => u.kind === "interval" && u.status === "active"));
      }
    }
  };

  const save = async () => {
    setBusy(true); setError(null); setStage("save");
    const { data, error: err } = await db.rpc("commit_sales_update", { p: payload() });
    setBusy(false);
    if (err) { setError(errorText(t, err)); setStage("validate"); return; }
    setSaved({ unchanged: !!(data as { unchanged: boolean }).unchanged });
  };

  const name = (id: string | null | undefined) => itemName(lang, ref.items.find((i) => i.id === id));
  const effQty = (rows: EffLine[] | undefined, id: string) => {
    const r = rows?.find((x) => x.item_id === id);
    return r ? Number(r.final_qty) + Number(r.prov_qty) : 0;
  };
  const changed = preview?.after ? [...new Set([...(preview.before ?? []), ...preview.after].map((r) => r.item_id))] : [];
  const excluded = preview?.after?.flatMap((r) => r.excluded.map((x) => ({ item: r.item_id, ...x }))) ?? [];

  if (!ref.isOwner && ref.me.role !== "partner") return <Notice kind="error">{t.errors.not_allowed}</Notice>;

  return (
    <section className="ics" ref={root}>
      <p><a href="#/iconsiam?tab=sales">← {t.ics.title}</a></p>
      <h1>{t.ics.impTitle}</h1>
      <p className="muted">{t.ics.impIntro}</p>
      <ol className="stages" aria-label={t.ics.stageLabel}>
        {STAGES.map((s, i) => {
          const at = STAGES.indexOf(saved ? "save" : stage);
          return (
            <li key={s} className={i < at || saved ? "is-done" : i === at ? "is-now" : ""} aria-current={i === at ? "step" : undefined}>
              <span className="stages__dot" aria-hidden="true">{i < at || saved ? <Icon name="check" size={16} /> : i + 1}</span>{t.ics.stage[s]}
            </li>
          );
        })}
      </ol>

      <div className="card form">
        <div className="grid">
          <Field label={t.ics.kindLabel} hint={t.ics.kindHint[kind]}>{(id, d) => (
            <select id={id} value={kind} aria-describedby={d} onChange={(e) => { setKind(e.target.value as Kind); reset(); }}>
              <option value="snapshot">{t.ics.kindOpt.snapshot}</option>
              <option value="interval">{t.ics.kindOpt.interval}</option>
            </select>
          )}</Field>
          {kind === "interval" && <>
            <Field label={t.ics.coverageStart}>{(id) => <input id={id} type="date" value={start} max={now} onChange={(e) => { setStart(e.target.value); reset(); }} />}</Field>
            <Field label={t.ics.coverageEnd}>{(id) => <input id={id} type="date" value={end} min={start} max={start ? monthRange(start.slice(0, 7)).to : now} onChange={(e) => { setEnd(e.target.value); reset(); }} />}</Field>
          </>}
          <Field label={t.ics.asOfLabel} hint={kind === "snapshot" ? fmt(t.ics.coverage, { from: dateLabel(lang, cs), to: dateLabel(lang, ce) }) : undefined}>{(id, d) => (
            <input id={id} type="date" value={asOf} max={now} aria-describedby={d} onChange={(e) => { setAsOf(e.target.value); reset(); }} />
          )}</Field>
          <Field label={t.ics.sourceType}>{(id) => <Select id={id} value={srcType} onChange={setSrcType}
            options={(["chat", "app", "file", "other"] as const).map((k) => ({ value: k, label: t.ics.sourceOpt[k] }))} />}</Field>
          <Field label={t.ics.reference}>{(id) => <input id={id} value={reference} onChange={(e) => { setReference(e.target.value); reset(); }} />}</Field>
          <Field label={t.ics.sourceRef} hint={t.ics.sourceRefHint} wide>{(id, d) => (
            <input id={id} className="mono" value={guard} placeholder={guardValue} aria-describedby={d} onChange={(e) => { setGuard(e.target.value); reset(); }} />
          )}</Field>
        </div>
        <Field label={t.ics.pasteLabel} hint={t.ics.pasteHint} wide>{(id, d) => (
          <textarea id={id} rows={5} className="mono" value={text} aria-describedby={d} onChange={(e) => setText(e.target.value)} />
        )}</Field>
        <Field label={t.ics.fileLabel}>{(id) => (
          <input id={id} type="file" accept=".csv,.json,.txt,text/csv,application/json" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) { const s = await f.text(); setText(s); doParse(s); if (!reference) setReference(f.name); }
          }} />
        )}</Field>
        <details className="why"><summary>{t.ics.formatHelp}</summary><p className="mono">{t.ics.formatText}</p></details>
        <div className="row"><button type="button" className="btn" onClick={() => doParse(text)}>{t.ics.parse}</button>
          {lines && <span className="muted">{fmt(t.ics.lineCount, { n: lines.length })}</span>}</div>
      </div>

      {lines && (
        <div className="card">
          <h2>{t.ics.stage.map}</h2>
          <div className="scroll">
            <table className="table">
              <thead><tr><th>{t.imp.itemCode}</th><th className="n">{t.f.qty}</th><th className="n">{t.ics.net}</th><th>{t.ics.colProduct}</th></tr></thead>
              <tbody>
                {lines.map((l, i) => {
                  const own = products.find((p) => p.code === l.code);
                  const m = preview?.matches[i];
                  const how = own && !chosen[i] ? "code" : chosen[i] ? "chosen" : m?.match;
                  const needs = !own && !chosen[i] && m && !m.item_id;
                  return (
                    <tr key={i}>
                      <td className="mono">{l.code}{l.description ? <span className="muted small"> · {l.description}</span> : null}</td>
                      <td className="n">{qty(l.qty)}</td>
                      <td className="n">{l.net == null ? "–" : money(l.net)}</td>
                      <td>
                        {own && !chosen[i] ? name(own.id) : m?.item_id && !chosen[i] ? name(m.item_id) : null}
                        {how && <span className={`tag ${needs ? "tag--warn" : "tag--ok"}`}>{t.ics.matchBy[how as keyof typeof t.ics.matchBy] ?? how}</span>}
                        {(needs || chosen[i]) && (
                          <Select id={`pick-${i}`} value={chosen[i] ?? m?.suggested ?? ""} placeholder={t.ics.choose}
                            options={products.map((p) => ({ value: p.id, label: `${itemName(lang, p)} · ${p.code}` }))}
                            onChange={(v) => { setChosen({ ...chosen, [i]: v }); setPreview(null); setStage("map"); }} />
                        )}
                        {m?.issues?.map((k) => <span key={k} className="tag tag--warn">{(t.ics.mapIssue as Record<string, string>)[k] ?? k}</span>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="row">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={runPreview}>{busy && stage !== "save" ? t.ics.working : t.ics.previewFinal}</button>
            <span className="small muted">{t.ics.notSavedYet}</span>
          </div>
        </div>
      )}

      {error && <Notice kind="error">{error}</Notice>}
      {intervals.length > 0 && error && (
        <fieldset className="card">
          <legend>{t.ics.replaces}</legend>
          {intervals.map((u) => (
            <label key={u.id} className="check">
              <input type="checkbox" checked={replaces.includes(u.id)} onChange={(e) => setReplaces(e.target.checked ? [...replaces, u.id] : replaces.filter((x) => x !== u.id))} />
              {fmt(t.ics.coverage, { from: dateLabel(lang, u.coverage_start), to: dateLabel(lang, u.coverage_end) })} · {qty(u.totals.units)} · <span className="mono">{u.source_ref}</span>
            </label>
          ))}
          <button type="button" className="btn" onClick={runPreview} disabled={busy || !replaces.length}>{t.ics.retry}</button>
        </fieldset>
      )}

      {preview?.ready && !preview.error && (
        <div className="card">
          <h2>{t.ics.previewTitle}</h2>
          {preview.unchanged ? <Notice kind="info">{t.ics.unchanged}</Notice> : (
            <div className="scroll">
              <table className="table">
                <thead><tr><th>{t.ics.colProduct}</th><th className="n">{t.ics.before}</th><th className="n">{t.ics.after}</th><th>{t.ics.stockEffect}</th></tr></thead>
                <tbody>
                  {changed.map((id) => {
                    const b = effQty(preview.before, id), a = effQty(preview.after, id);
                    const st = preview.stock?.find((x) => x.item_id === id);
                    if (a === b && !st) return null;
                    return (
                      <tr key={id}>
                        <td>{name(id)}</td><td className="n">{qty(b)}</td><td className="n"><strong>{qty(a)}</strong></td>
                        <td>{st && Number(st.diff) !== 0 ? <>{Number(st.diff) > 0 ? "−" : "+"}{qty(Math.abs(Number(st.diff)))} · {t.ics.bucket[st.bucket as keyof typeof t.ics.bucket] ?? st.bucket}</> : t.ics.noChange}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {excluded.length > 0 && <p className="warn"><span aria-hidden="true">⚠</span> {t.ics.excludedOverlap}: {excluded.map((x) => name(x.item)).join(", ")}</p>}
          {saved ? (
            <Notice kind="ok"><Icon name="check" size={18} /> {saved.unchanged ? t.ics.unchanged : t.ics.savedOk} · <a href="#/iconsiam?tab=stock">{t.ics.tabStock}</a></Notice>
          ) : (
            <div className="row row--end">
              <button type="button" className="btn btn--primary" disabled={busy} onClick={save}>{busy ? t.ics.working : t.ics.confirmSave}</button>
            </div>
          )}
        </div>
      )}

      {ref.isOwner && (
        <p className="notice notice--info">{t.ics.finalViaForm} <a href="#/new/consignment">{t.ics.openFinalForm}</a></p>
      )}
    </section>
  );
}
