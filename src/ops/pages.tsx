// Overview, records, record detail, stock and approvals.
import { useEffect, useState, type ReactNode } from "react";
import {
  db, errorText, fmt, money, qty as fq, receiptUrl, seesMoney, today, useQuery,
  type AuditRow, type Doc, type DocLine, type DocType, type Status, type StockRow,
} from "./api";
import { Field, NumberInput, Notice, Select, StatusBadge, unitLabel, useNames, useOps } from "./ui";
import { BatchConsumption, CategoryFilter } from "./forms";

export const DOC_COLUMNS = "id,doc_no,doc_type,doc_date,location_code,status,total,data,note,attachments,needs_approval,approved_by,approved_at,decision_note,reverses_doc,reversed_by_doc,disputed,dispute_note,created_by,created_at";

// ---------- records ----------

export function DocList({ docs, loading }: { docs: Doc[]; loading?: boolean }) {
  const { t } = useOps();
  const names = useNames();
  if (loading && !docs.length) return <p>{t.loading}</p>;
  if (!docs.length) return <p className="muted">{t.records.empty}</p>;
  return (
    <ul className="docs">
      {docs.map((d) => (
        <li key={d.id}>
          <a href={`#/record/${d.id}`} className="doc">
            <span className="doc__main">
              <strong>{t.types[d.doc_type]}</strong> <span className="mono">{d.doc_no}</span>
              {d.disputed && <span className="badge badge--disputed">!</span>}
            </span>
            <span className="doc__meta">{d.doc_date} · {names.loc(d.location_code)} · {fmt(t.records.by, { name: names.member(d.created_by) })}</span>
            <span className="doc__end">
              {d.total != null && <span className="doc__total">{fmt(t.baht, { n: money(d.total) })}</span>}
              {d.doc_type === "production" && d.status === "posted" && !d.reverses_doc && (d.data as { materials?: string }).materials === "pending"
                && <span className="badge badge--pending">{t.batch.pending}</span>}
              <StatusBadge status={d.status} />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Records({ params }: { params?: URLSearchParams }) {
  const { t, ref, lang } = useOps();
  // Filters can come from a link (#/records?type=…&status=…&from=…&to=…&loc=…&materials=pending).
  const [type, setType] = useState(params?.get("type") ?? "");
  const [status, setStatus] = useState(params?.get("status") ?? "");
  const [from, setFrom] = useState(params?.get("from") ?? "");
  const [to, setTo] = useState(params?.get("to") ?? "");
  const [loc, setLoc] = useState(params?.get("loc") ?? "");
  const [pendingOnly, setPendingOnly] = useState(params?.get("materials") === "pending");
  const docs = useQuery<Doc[]>(() => {
    let q = db.from("documents").select(DOC_COLUMNS).order("doc_date", { ascending: false }).order("created_at", { ascending: false }).limit(200);
    if (type) q = q.eq("doc_type", type);
    if (status) q = q.eq("status", status);
    if (from) q = q.gte("doc_date", from);
    if (to) q = q.lte("doc_date", to);
    if (loc) q = q.eq("location_code", loc);
    if (pendingOnly) q = q.eq("doc_type", "production").eq("status", "posted").is("reverses_doc", null).eq("data->>materials", "pending");
    return q;
  }, [type, status, from, to, loc, pendingOnly]);
  return (
    <section>
      <h1>{t.nav.records}</h1>
      <div className="filters">
        <Field label={t.records.filterType}>{(id) => <Select id={id} value={type} onChange={setType} placeholder={t.all}
          options={(Object.keys(t.types) as DocType[]).map((k) => ({ value: k, label: t.types[k] }))} />}</Field>
        <Field label={t.records.filterStatus}>{(id) => <Select id={id} value={status} onChange={setStatus} placeholder={t.all}
          options={(Object.keys(t.status) as Status[]).map((k) => ({ value: k, label: t.status[k] }))} />}</Field>
        <Field label={t.rep.from}>{(id) => <input id={id} type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />}</Field>
        <Field label={t.rep.to}>{(id) => <input id={id} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />}</Field>
        <Field label={t.dash.branch}>{(id) => <Select id={id} value={loc} onChange={setLoc} placeholder={t.dash.allBranches}
          options={ref.locations.filter((l) => l.kind !== "transit").map((l) => ({ value: l.code, label: lang === "th" ? l.name_th : l.name_en }))} />}</Field>
        <label className="check"><input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} /> {t.dash.pendingOnly}</label>
      </div>
      {docs.error ? <Notice kind="error">{errorText(t, docs.error)}</Notice> : <DocList docs={docs.data ?? []} loading={docs.loading} />}
    </section>
  );
}

export function Approvals() {
  const { t, ref } = useOps();
  const docs = useQuery<Doc[]>(() => db.from("documents").select(DOC_COLUMNS).eq("status", "pending").order("created_at"), []);
  return (
    <section>
      <h1>{t.approvals.title}</h1>
      {!ref.isOwner && <p className="muted">{t.approvals.adminApproves}</p>}
      {docs.data && !docs.data.length ? <p className="muted">{t.approvals.empty}</p> : <DocList docs={docs.data ?? []} loading={docs.loading} />}
    </section>
  );
}

// ---------- one record ----------

export function RecordDetail({ id, fresh }: { id: string; fresh?: boolean }) {
  const { t, ref, lang } = useOps();
  const names = useNames();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [lines, setLines] = useState<DocLine[]>([]);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [related, setRelated] = useState<Doc | null>(null);
  const [settlement, setSettlement] = useState<{ received: number; open_amount: number } | null>(null);
  const [entries, setEntries] = useState<Doc[]>([]);
  const [batch, setBatch] = useState<Doc | null>(null);
  const [negatives, setNegatives] = useState<StockRow[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = async () => {
    const [d, l] = await Promise.all([
      db.from("documents").select(DOC_COLUMNS).eq("id", id).maybeSingle(),
      db.from("doc_lines").select("*").eq("doc_id", id).order("line_no"),
    ]);
    if (d.error || !d.data) { setLoadError(d.error ?? new Error("balena:not_found")); return; }
    const docRow = d.data as Doc;
    setDoc(docRow);
    setLines((l.data ?? []) as DocLine[]);
    if (docRow.doc_type === "consignment" || docRow.doc_type === "sale") {
      db.from("receivables").select("received,open_amount").eq("id", id).maybeSingle().then((r) => setSettlement(r.data as { received: number; open_amount: number } | null));
    }
    const lineRows = (l.data ?? []) as DocLine[];
    if (docRow.doc_type === "production") {
      db.from("documents").select(DOC_COLUMNS).eq("doc_type", "consumption").eq("data->>batch_id", id).order("created_at")
        .then((r) => setEntries((r.data ?? []) as Doc[]));
    }
    const batchId = (docRow.data as { batch_id?: string }).batch_id;
    if (batchId) db.from("documents").select(DOC_COLUMNS).eq("id", batchId).maybeSingle().then((r) => setBatch(r.data as Doc | null));
    const itemIds = [...new Set(lineRows.map((x) => x.item_id).filter(Boolean))] as string[];
    if (itemIds.length && docRow.location_code) {
      db.from("stock_on_hand").select("*").eq("location_code", docRow.location_code).in("item_id", itemIds).lt("qty", 0)
        .then((r) => setNegatives((r.data ?? []) as StockRow[]));
    } else setNegatives([]);
    const rel = docRow.reverses_doc ?? docRow.reversed_by_doc;
    if (rel) db.from("documents").select(DOC_COLUMNS).eq("id", rel).maybeSingle().then((r) => setRelated(r.data as Doc | null));
    else setRelated(null);
    if (seesMoney(ref.me.role)) {
      db.from("audit_log").select("*").eq("table_name", "documents").eq("record_id", id).order("at").then((r) => setHistory((r.data ?? []) as AuditRow[]));
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  const act = async (run: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setMsg(null);
    const { error } = await run();
    if (error) setMsg({ kind: "error", text: errorText(t, error) });
    else { setMsg({ kind: "ok", text: ok }); await load(); }
  };

  if (loadError) return <Notice kind="error">{errorText(t, loadError)}</Notice>;
  if (!doc) return <p>{t.loading}</p>;
  const data = doc.data as Record<string, string | number | boolean | undefined>;
  const isOwner = ref.isOwner;
  const canReverse = doc.status === "posted" && !doc.reverses_doc && (isOwner || (doc.created_by === ref.me.id && !doc.needs_approval));
  const awaitingReceipt = doc.doc_type === "transfer" && doc.status === "posted" && !doc.reverses_doc && !data.received_at;

  const receiptLabel = settlement == null ? t.receipt.unconfirmed
    : Number(settlement.open_amount) === 0 ? t.receipt.settled : Number(settlement.received) > 0 ? t.receipt.partly_received : t.receipt.unconfirmed;
  const facts: [string, ReactNode][] = [
    [t.f.date, doc.doc_date],
    [t.f.location, names.loc(doc.location_code)],
  ];
  if (data.to) facts.push([t.f.to, names.loc(String(data.to))]);
  if (data.channel) facts.push([t.f.channel, names.channel(data.channel)]);
  if (data.kind && doc.doc_type === "production") facts.push([t.f.kind, t.production[data.kind as keyof typeof t.production]]);
  if (doc.doc_type === "production" && data.materials) facts.push([t.itm.status, data.materials === "pending" ? t.batch.pending : t.batch.done]);
  if (data.cost_status) facts.push([t.batch.cost, `${t.batch[`cost_${data.cost_status}` as "cost_complete"]}${data.unit_cost != null ? ` · ${fmt(t.batch.perUnit, { n: money(Number(data.unit_cost)) })}` : ""}`]);
  if (data.reason) facts.push([t.inv.reason, String(data.reason)]);
  if (data.kind && doc.doc_type === "partner") facts.push([t.f.kind, t.partnerKinds[data.kind as keyof typeof t.partnerKinds]]);
  if (data.member) facts.push([t.f.member, names.member(String(data.member))]);
  if (data.category) facts.push([t.f.category, t.categories[data.category as keyof typeof t.categories] ?? String(data.category)]);
  if (data.supplier) facts.push([t.f.supplier, String(data.supplier)]);
  if (data.order_ref) facts.push([t.f.orderRef, String(data.order_ref)]);
  if (data.report_no) facts.push([t.f.reportNo, String(data.report_no)]);
  if (data.branch_name || data.branch_code) facts.push([t.imp.branchName, [data.branch_code, data.branch_name].filter(Boolean).join(" · ")]);
  if (data.period_start) facts.push([t.imp.periodStart, fmt(t.rep.period, { from: String(data.period_start), to: String(data.period_end) })]);
  if (data.generated_at) facts.push([t.imp.generated, String(data.generated_at).slice(0, 10)]);
  if (data.units != null) facts.push([t.rep.units, fq(Number(data.units))]);
  if (data.paid) facts.push([t.f.paid, paidLabel(String(data.paid))]);
  if (data.account) facts.push([t.f.account, names.account(data.account)]);
  if (data.direction) facts.push([t.f.direction, data.direction === "in" ? t.f.dirIn : t.f.dirOut]);
  if (data.shipping) facts.push([t.f.shipping, fmt(t.baht, { n: money(Number(data.shipping)) })]);
  if (data.gp_percent != null) facts.push([t.f.gp, `${data.gp_percent}% · ${fmt(t.baht, { n: money(Number(data.gp_amount)) })}`]);
  if (data.amount_due != null) facts.push([t.f.due, fmt(t.baht, { n: money(Number(data.amount_due)) })]);
  if (data.due_date) facts.push([t.f.dueDate, String(data.due_date)]);
  if (data.receipt_status) facts.push([t.imp.receiptHead, receiptLabel]);
  if (data.stock) facts.push([t.nav.stock, t.stockStatus[data.stock as "deduct"] ?? String(data.stock)]);
  if (data.cost === "unavailable") facts.push([t.rep.cogs, t.rep.missing]);
  const src = (doc.data.import as { source?: { file?: string; sha256?: string } } | undefined)?.source;
  if (src?.file) facts.push([t.imp.file, src.sha256 ? `${src.file} · SHA-256 ${src.sha256.slice(0, 12)}…` : src.file]);
  if (data.roast_loss_pct != null) facts.push([t.f.kind, fmt(t.records.roastLoss, { pct: String(data.roast_loss_pct) })]);
  if (data.no_receipt_reason) facts.push([t.f.noReceipt, String(data.no_receipt_reason)]);
  if (data.received_at) facts.push([t.records.received.replace(" {date}", ""), `${data.received_at}${data.receipt_note ? ` · ${data.receipt_note}` : ""}`]);
  if (doc.note) facts.push([t.f.note, doc.note]);
  facts.push(["", fmt(t.records.by, { name: names.member(doc.created_by) })]);

  function paidLabel(p: string) {
    if (p === "payout") return t.f.payout;
    if (p === "unpaid") return doc!.doc_type === "sale" ? t.f.unpaidSale : t.f.unpaid;
    if (p.startsWith("member:")) return fmt(t.f.paidPersonally, { name: names.member(p.slice(7)) });
    return names.account(p);
  }

  return (
    <section>
      <p><a href="#/records">← {t.nav.records}</a></p>
      {fresh && <Notice kind="ok">{fmt(doc.status === "pending" ? t.postedPending : t.posted, { no: doc.doc_no })}</Notice>}
      <div className="row row--between">
        <h1>{t.types[doc.doc_type]} <span className="mono">{doc.doc_no}</span></h1>
        <StatusBadge status={doc.status} />
      </div>
      {doc.reverses_doc && related && <p><a href={`#/record/${related.id}`}>{fmt(t.records.reversalOf, { no: related.doc_no })}</a></p>}
      {doc.reversed_by_doc && related && <p><a href={`#/record/${related.id}`}>{t.records.reversedBy}: {related.doc_no}</a></p>}
      {doc.disputed && <Notice kind="error">{fmt(t.records.disputed, { note: doc.dispute_note })}</Notice>}
      {batch && <p><a href={`#/record/${batch.id}`}>{fmt(t.batch.ofBatch, { no: batch.doc_no })}</a></p>}
      {Array.isArray(doc.data.warnings) && (doc.data.warnings as string[]).map((w) => (
        <p key={w} className="warn" role="status"><span aria-hidden="true">⚠</span> {(t.inv as Record<string, string>)[w] ?? w}</p>
      ))}
      {negatives.map((n) => (
        <p key={n.item_id} className="warn" role="status">
          <span aria-hidden="true">⚠</span> {t.inv.negWarn} {lang === "th" ? n.name_th : n.name_en}: {fq(n.qty)} {unitLabel(t, n.base_unit)} ·{" "}
          <a href={`#/moves/${n.item_id}/${n.location_code}`}>{t.stock.movements}</a>
        </p>
      ))}
      {doc.decision_note && <p className="muted">{fmt(t.records.decision, { note: doc.decision_note })}</p>}

      <dl className="facts">
        {facts.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}
        {doc.total != null && <div><dt>{t.f.total}</dt><dd><strong>{fmt(t.baht, { n: money(doc.total) })}</strong></dd></div>}
      </dl>

      {lines.length > 0 && (
        <>
          <h2>{t.records.lines}</h2>
          <div className="scroll">
            <table className="table">
              <thead><tr><th>{t.f.item}</th><th className="n">{t.f.qty}</th><th className="n">{t.f.unitPrice}</th><th className="n">{t.f.lineAmount}</th><th></th></tr></thead>
              <tbody>
                {lines.map((l) => {
                  const item = ref.items.find((i) => i.id === l.item_id);
                  const x = l.extra as Record<string, string | number | object | undefined>;
                  const label = l.item_id ? names.item(l.item_id)
                    : x.kind === "money" ? `${t.f.moneyLine}: ${names.account(x.account)}`
                      : x.kind === "partner" ? `${t.f.partnerLine}: ${names.member(String(x.member))}` : "–";
                  const notes = [
                    x.dir === "in" ? t.f.inputs : x.dir === "out" ? t.f.output : null,
                    x.entered && typeof x.entered === "object" && (x.entered as { unit?: string }).unit !== item?.base_unit
                      ? fmt(t.inv.entered, { qty: fq(Number((x.entered as { qty?: number }).qty)), unit: unitLabel(t, String((x.entered as { unit?: string }).unit)) }) : null,
                    x.item_code ? `${t.rep.itemCode} ${x.item_code}` : null,
                    x.source_name ? `${t.rep.sourceName}: ${x.source_name}` : null,
                    x.supplier_amount != null ? `${t.rep.supplierAmount} ${money(Number(x.supplier_amount))}` : null,
                    x.location ? names.loc(String(x.location)) : null,
                    x.system_qty_at_posting != null ? fmt(t.records.systemQty, { n: fq(Number(x.system_qty_at_posting)) }) : null,
                    x.received != null ? `${t.records.receiveQty} ${fq(Number(x.received))}` : null,
                    Number(x.short) > 0 ? fmt(t.records.short, { n: fq(Number(x.short)) }) : null,
                  ].filter(Boolean).join(" · ");
                  return (
                    <tr key={l.id}>
                      <td>{label}</td>
                      <td className="n">{l.qty != null ? `${fq(l.qty)} ${item ? t.units[item.base_unit] : ""}` : ""}</td>
                      <td className="n">{l.unit_price != null ? money(l.unit_price) : ""}</td>
                      <td className="n">{l.amount != null ? money(l.amount) : ""}</td>
                      <td className="muted">{notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {doc.doc_type === "production" && doc.status === "posted" && !doc.reverses_doc && (data.materials === "pending" || entries.length > 0) && (
        <section className="batch">
          <h2>{t.batch.entries}</h2>
          {entries.length ? <DocList docs={entries} /> : <p className="muted">{t.batch.noEntries}</p>}
          {data.materials === "pending" && (
            <>
              <p className="muted">{t.batch.costPending}</p>
              <BatchConsumption batchId={doc.id} kind={String(data.kind)} location={doc.location_code ?? ""} onSaved={load} />
              <div className="row">
                <button type="button" className="btn btn--primary"
                  disabled={!entries.some((e) => e.status === "posted" && !e.reverses_doc)}
                  onClick={() => act(() => db.rpc("complete_batch", { p_id: doc.id, p_note: null }), t.batch.completed)}>{t.batch.complete}</button>
                <span className="muted small">{t.batch.completeHint}</span>
              </div>
            </>
          )}
        </section>
      )}

      {doc.attachments.length > 0 && (
        <>
          <h2>{t.records.attachments}</h2>
          <ul className="plain">{doc.attachments.map((p) => <li key={p}><AttachmentLink path={p} /></li>)}</ul>
        </>
      )}

      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <div className="actions">
        {isOwner && doc.status === "pending" && <Decide onDecide={(approve, note) => act(() => db.rpc("decide_document", { p_id: doc.id, p_approve: approve, p_note: note || null }), approve ? t.status.posted : t.status.rejected)} />}
        {awaitingReceipt && <Receive lines={lines} onReceive={(date, received, reason) => act(() => db.rpc("receive_transfer", { p_id: doc.id, p_date: date, p_received: received, p_reason: reason || null }), t.records.received.replace("{date}", date))} />}
        {canReverse && <Reverse onReverse={(date, reason) => act(() => db.rpc("reverse_document", { p_id: doc.id, p_date: date, p_reason: reason }), t.status.reversed)} />}
        {seesMoney(ref.me.role) && (
          <Dispute open={doc.disputed} onSubmit={(note) => act(() => db.rpc("dispute_document", { p_id: doc.id, p_note: note, p_open: !doc.disputed }), t.settings.saved)} />
        )}
      </div>

      {history.length > 0 && (
        <details className="history">
          <summary>{t.records.history}</summary>
          <ol>
            {history.map((h) => (
              <li key={h.id}>
                <span className="mono">{new Date(h.at).toLocaleString(lang === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok" })}</span>
                {" · "}{names.member(h.member_id)} · {h.action}{h.reason ? ` · ${h.reason}` : ""}
                {h.action === "update" && <DiffLine before={h.old_values} after={h.new_values} />}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

/** Shows only the fields an update changed. */
function DiffLine({ before, after }: { before: unknown; after: unknown }) {
  const a = (before ?? {}) as Record<string, unknown>;
  const b = (after ?? {}) as Record<string, unknown>;
  const keys = Object.keys(b).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  if (!keys.length) return null;
  return <ul className="diff">{keys.map((k) => <li key={k}><span className="mono">{k}</span>: {JSON.stringify(a[k])} → {JSON.stringify(b[k])}</li>)}</ul>;
}

function AttachmentLink({ path }: { path: string }) {
  const { t } = useOps();
  const [url, setUrl] = useState<string | null>(null);
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer">{path.split("/").pop()}</a>
    : <button type="button" className="link" onClick={async () => { const u = await receiptUrl(path); if (u) { setUrl(u); window.open(u, "_blank", "noopener"); } }}>{t.records.open}: {path.split("/").pop()}</button>;
}

function Decide({ onDecide }: { onDecide: (approve: boolean, note: string) => void }) {
  const { t } = useOps();
  const [note, setNote] = useState("");
  return (
    <div className="card form">
      <Field label={`${t.f.reason} ${t.optional}`}>{(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      <div className="row">
        <button type="button" className="btn btn--primary" onClick={() => onDecide(true, note)}>{t.records.approve}</button>
        <button type="button" className="btn btn--danger" onClick={() => onDecide(false, note)}>{t.records.reject}</button>
      </div>
    </div>
  );
}

function Reverse({ onReverse }: { onReverse: (date: string, reason: string) => void }) {
  const { t } = useOps();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>{t.records.reverse}</button>;
  return (
    <div className="card form">
      <p className="muted">{t.records.reverseHint}</p>
      <Field label={t.f.date}>{(id) => <input id={id} type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      <Field label={t.f.reason}>{(id) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      <div className="row">
        <button type="button" className="btn" onClick={() => setOpen(false)}>{t.cancel}</button>
        <button type="button" className="btn btn--danger" onClick={() => onReverse(date, reason)}>{t.records.reverse}</button>
      </div>
    </div>
  );
}

function Dispute({ open, onSubmit }: { open: boolean; onSubmit: (note: string) => void }) {
  const { t } = useOps();
  const [show, setShow] = useState(false);
  const [note, setNote] = useState("");
  const label = open ? t.records.resolve : t.records.dispute;
  if (!show) return <button type="button" className="btn" onClick={() => setShow(true)}>{label}</button>;
  return (
    <div className="card form">
      <Field label={t.f.reason}>{(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      <div className="row">
        <button type="button" className="btn" onClick={() => setShow(false)}>{t.cancel}</button>
        <button type="button" className="btn btn--primary" onClick={() => onSubmit(note)}>{label}</button>
      </div>
    </div>
  );
}

function Receive({ lines, onReceive }: { lines: DocLine[]; onReceive: (date: string, received: Record<string, number>, reason: string) => void }) {
  const { t } = useOps();
  const names = useNames();
  const [date, setDate] = useState(today);
  const [got, setGot] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.id, String(l.qty ?? "")])));
  const [reason, setReason] = useState("");
  return (
    <div className="card form">
      <h2>{t.records.receive}</h2>
      <Field label={t.f.date}>{(id) => <input id={id} type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      {lines.map((l) => (
        <Field key={l.id} label={`${names.item(l.item_id)} (${fq(l.qty)})`}>
          {(id) => <NumberInput id={id} value={got[l.id] ?? ""} onChange={(v) => setGot({ ...got, [l.id]: v })} />}
        </Field>
      ))}
      <Field label={`${t.f.reason} ${t.optional}`}>{(id) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      <button type="button" className="btn btn--primary"
        onClick={() => onReceive(date, Object.fromEntries(Object.entries(got).map(([k, v]) => [k, Number(v)])), reason)}>{t.records.receive}</button>
    </div>
  );
}

// ---------- stock ----------

export function StockTable({ rows }: { rows: StockRow[] }) {
  const { t, ref, lang } = useOps();
  const names = useNames();
  const money_ = seesMoney(ref.me.role);
  return (
    <div className="scroll">
      <table className="table">
        <thead>
          <tr>
            <th>{t.f.item}</th><th>{t.f.location}</th><th className="n">{t.f.qty}</th>
            {money_ && <><th className="n">{t.stock.avgCost}</th><th className="n">{t.stock.value}</th></>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.item_id}-${r.location_code}`} className={Number(r.qty) < 0 ? "neg" : r.min_level != null && Number(r.qty) < Number(r.min_level) ? "low" : undefined}>
              <td>{lang === "th" ? r.name_th : r.name_en}<br /><span className="muted">{names.category(r.category_code)}{r.min_level != null ? ` · ${fmt(t.stock.min, { n: fq(r.min_level) })}` : ""}</span></td>
              <td>{names.loc(r.location_code)}</td>
              <td className="n">
                {Number(r.qty) < 0 && <span className="badge badge--neg"><span aria-hidden="true">⚠</span> {t.stock.negative}</span>}{" "}
                {fq(r.qty)} {unitLabel(t, r.base_unit)}<br />
                <a className="small" href={`#/moves/${r.item_id}/${r.location_code}`}>{t.stock.movements}</a>
              </td>
              {money_ && <><td className="n">{r.avg_cost != null ? money(r.avg_cost) : t.unknown}</td><td className="n">{r.value != null ? money(r.value) : "–"}</td></>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StockPage({ params }: { params?: URLSearchParams }) {
  const { t, ref, lang } = useOps();
  const [category, setCategory] = useState("");
  // From the Overview: #/stock?neg=1&loc=BY shows only negative rows (at that branch).
  const [negOnly, setNegOnly] = useState(params?.get("neg") === "1");
  const [loc, setLoc] = useState(params?.get("loc") ?? "");
  const stock = useQuery<StockRow[]>(() => db.from("stock_on_hand").select("*").order("location_code").order("kind").order("name_en"), []);
  const transit = useQuery<Doc[]>(() => db.from("documents").select(DOC_COLUMNS).eq("doc_type", "transfer").eq("status", "posted")
    .is("reverses_doc", null).is("data->>received_at", null).order("doc_date"), []);
  const rows = (stock.data ?? []).filter((r) => r.location_code !== "TRANSIT"
    && (!loc || r.location_code === loc) && (!negOnly || Number(r.qty) < 0)
    && (!category || r.category_code === category || ref.categories.some((c) => c.code === r.category_code && c.parent_code === category)))
    .sort((a, b) => Number(Number(b.qty) < 0) - Number(Number(a.qty) < 0));
  const negativeCount = rows.filter((r) => Number(r.qty) < 0).length;
  return (
    <section>
      <h1>{t.stock.title}</h1>
      <div className="filters">
        <CategoryFilter value={category} onChange={setCategory} />
        <Field label={t.dash.branch}>{(id) => <Select id={id} value={loc} onChange={setLoc} placeholder={t.dash.allBranches}
          options={ref.locations.filter((l) => l.kind !== "transit").map((l) => ({ value: l.code, label: lang === "th" ? l.name_th : l.name_en }))} />}</Field>
        <label className="check"><input type="checkbox" checked={negOnly} onChange={(e) => setNegOnly(e.target.checked)} /> {t.dash.negativeOnly}</label>
      </div>
      {negativeCount > 0 && <p className="warn" role="status"><span aria-hidden="true">⚠</span> {t.inv.negWarn} ({fmt(t.ov.attnNegative, { n: negativeCount })})</p>}
      {stock.error ? <Notice kind="error">{errorText(t, stock.error)}</Notice>
        : stock.loading ? <p>{t.loading}</p>
          : rows.length ? <StockTable rows={rows} /> : <p className="muted">{t.stock.empty}</p>}
      {(transit.data ?? []).length > 0 && (
        <>
          <h2>{t.stock.transit}</h2>
          <DocList docs={transit.data ?? []} />
        </>
      )}
    </section>
  );
}

// ---------- movements of one item at one location ----------

interface MoveRow { id: number; move_date: string; qty: number; unit_cost: number | null; kind: string; doc_type: string; doc_id: string; provisional: boolean }

export function Movements({ itemId, location }: { itemId: string; location: string }) {
  const { t, ref, lang } = useOps();
  const names = useNames();
  const item = ref.items.find((i) => i.id === itemId);
  const moves = useQuery<MoveRow[]>(() => db.from("stock_moves").select("id,move_date,qty,unit_cost,kind,doc_type,doc_id,provisional")
    .eq("item_id", itemId).eq("location_code", location).order("id"), [itemId, location]);
  const [docNos, setDocNos] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = [...new Set((moves.data ?? []).map((m) => m.doc_id))];
    if (ids.length) db.from("documents").select("id,doc_no").in("id", ids).then((r) =>
      setDocNos(Object.fromEntries(((r.data ?? []) as { id: string; doc_no: string }[]).map((d) => [d.id, d.doc_no]))));
  }, [moves.data]);
  let running = 0;
  const rows = (moves.data ?? []).map((m) => ({ ...m, balance: (running += Number(m.qty)) }));
  return (
    <section>
      <p><a href="#/stock">← {t.nav.stock}</a></p>
      <h1>{t.stock.movesTitle}</h1>
      <p><strong>{item ? (lang === "th" ? item.name_th : item.name_en) : "?"}</strong> · {names.loc(location)}</p>
      {moves.error ? <Notice kind="error">{errorText(t, moves.error)}</Notice> : (
        <div className="scroll">
          <table className="table">
            <thead><tr><th>{t.f.date}</th><th>{t.records.lines}</th><th className="n">{t.f.qty}</th><th className="n">{t.stock.balance}</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className={m.balance < 0 ? "neg" : undefined}>
                  <td>{m.move_date}</td>
                  <td><a href={`#/record/${m.doc_id}`}>{docNos[m.doc_id] ?? m.doc_type}</a>{m.provisional && <span className="muted small"> · {t.stock.provisional}</span>}</td>
                  <td className="n">{Number(m.qty) > 0 ? "+" : ""}{fq(m.qty)} {unitLabel(t, item?.base_unit ?? "")}</td>
                  <td className="n">{fq(m.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
