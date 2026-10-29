// ICONSIAM deliveries: plan (no stock change) → dispatch (branch → in transit) → receipt at the store
// (accepted / rejected / missing per line). Also the code-mapping review (owner), the document
// details printed on delivery notes (owner) and the printable delivery note and stock card.
// A delivery is never a sale, and the GP printed on it is a contract reference, not a deduction.
import { useEffect, useRef, useState } from "react";
import { opsText } from "../i18n/ops";
import type { Lang } from "../i18n/lang";
import { db, errorText, fmt, ICS, money, newKey, priceFor, qty, today, useQuery, type ChannelProfile, type ItemMap, type Shipment } from "./api";
import { Icon } from "./icons";
import { ProductThumb, useToast, useWiggle } from "./motion";
import { Field, Notice, NumberInput, Select, itemName, useOps } from "./ui";
import { dateLabel } from "./iconsiam";

const shipQuery = () => db.from("consignment_shipments").select("*, consignment_shipment_lines(*)").eq("channel_code", ICS.channel);

export function ShipStatus({ s }: { s: Shipment["status"] }) {
  const { t } = useOps();
  return <span className={`sstatus sstatus--${s}`}>{t.ics.shipStatus[s]}</span>;
}

function useWorkspace() {
  const root = useRef<HTMLElement>(null);
  useWiggle(root);
  return root;
}

function Back() {
  const { t } = useOps();
  return <p><a href="#/iconsiam?tab=stock">← {t.ics.title}</a></p>;
}

// ---------- list ----------

export function ShipmentList() {
  const { t, lang } = useOps();
  const root = useWorkspace();
  const q = useQuery(() => shipQuery().order("doc_date", { ascending: false }).order("created_at", { ascending: false }) as unknown as PromiseLike<{ data: Shipment[] | null; error: unknown }>, []);
  return (
    <section className="ics" ref={root}>
      <Back />
      <div className="row row--between">
        <h1>{t.ics.shipTitle}</h1>
        <a className="btn btn--primary" href="#/iconsiam/ship/new"><Icon name="truck" /> {t.ics.shipNew}</a>
      </div>
      <p className="muted">{t.ics.planNote}</p>
      {q.error ? <Notice kind="error">{errorText(t, q.error)}</Notice> : !q.data ? <p>{t.loading}</p> : !q.data.length ? <p className="panel muted">{t.ics.shipEmpty}</p> : (
        <ul className="docs">
          {q.data.map((s) => {
            const units = s.consignment_shipment_lines.reduce((n, l) => n + Number(l.qty), 0);
            return (
              <li key={s.id}>
                <a className="doc" href={`#/iconsiam/ship/${s.id}`}>
                  <span className="doc__main"><strong className="mono">{s.ship_no}</strong> · {fmt(t.ics.lineCount, { n: s.consignment_shipment_lines.length })} · {qty(units)}</span>
                  <span className="doc__meta">
                    {s.status === "planned" ? `${t.ics.plannedDispatch} ${dateLabel(lang, s.planned_dispatch)}`
                      : s.status === "dispatched" ? `${t.ics.dispatchedOn} ${dateLabel(lang, s.dispatched_on)} · ${t.ics.expectedArrival} ${dateLabel(lang, s.expected_arrival)}`
                        : s.received_on ? `${t.ics.receivedOn} ${dateLabel(lang, s.received_on)} · ${t.ics.receiptStatus[s.receipt_status]}` : dateLabel(lang, s.doc_date)}
                  </span>
                  <span className="doc__end"><ShipStatus s={s.status} /></span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------- plan ----------

type PlanLine = { item: string; qty: string; price: string };

export function ShipmentNew({ params }: { params: URLSearchParams }) {
  const { t, ref, lang, go } = useOps();
  const root = useWorkspace();
  const products = ref.items.filter((i) => i.kind === "product" && i.active);
  const own = ref.locations.filter((l) => l.kind === "own" && l.active);
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState(own.find((l) => l.code === "BY")?.code ?? own[0]?.code ?? "");
  const [dispatch, setDispatch] = useState("");
  const [arrival, setArrival] = useState("");
  const [note, setNote] = useState("");
  const price = (id: string) => { const p = priceFor(ref, id, ICS.channel, date); return p == null ? "" : String(p); };
  const first = params.get("item") ?? "";
  const [lines, setLines] = useState<PlanLine[]>([{ item: first, qty: params.get("qty") ?? "", price: first ? price(first) : "" }]);
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (i: number, patch: Partial<PlanLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const units = lines.reduce((n, l) => n + (Number(l.qty) || 0), 0);
  const value = lines.reduce((n, l) => n + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);

  const save = async () => {
    setBusy(true); setError(null);
    const { data, error: err } = await db.rpc("save_shipment", { p: {
      channel: ICS.channel, location_code: ICS.location, from_location: from, doc_date: date, planned_dispatch: dispatch || null,
      expected_arrival: arrival || null, note, client_key: key, source: { type: "app" },
      lines: lines.filter((l) => l.item).map((l) => {
        const it = products.find((p) => p.id === l.item)!;
        return { item_id: it.id, source_code: it.iconsiam_code, barcode: it.barcode, description: itemName(lang, it),
          package_size: it.size_value ? `${it.size_value} ${it.size_unit ?? ""}`.trim() : null, qty: Number(l.qty), unit_price: l.price === "" ? null : Number(l.price) };
      }),
    } });
    setBusy(false);
    if (err) setError(errorText(t, err)); else go(`/iconsiam/ship/${(data as Shipment).id}`);
  };

  return (
    <section className="ics" ref={root}>
      <p><a href="#/iconsiam/ship">← {t.ics.shipTitle}</a></p>
      <h1>{t.ics.shipNew}</h1>
      <p className="notice notice--info">{t.ics.planNote}</p>
      <form className="card form" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <div className="grid">
          <Field label={t.ics.docDate}>{(id) => <input id={id} type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label={t.ics.fromLoc}>{(id) => <Select id={id} value={from} onChange={setFrom} options={own.map((l) => ({ value: l.code, label: lang === "th" ? l.name_th : l.name_en }))} />}</Field>
          <Field label={t.ics.plannedDispatch}>{(id) => <input id={id} type="date" value={dispatch} onChange={(e) => setDispatch(e.target.value)} />}</Field>
          <Field label={t.ics.expectedArrival}>{(id) => <input id={id} type="date" value={arrival} min={dispatch || undefined} onChange={(e) => setArrival(e.target.value)} />}</Field>
        </div>
        <fieldset className="lines">
          <legend>{t.records.lines}</legend>
          {lines.map((l, i) => {
            const it = products.find((p) => p.id === l.item);
            return (
              <div className="line" key={i}>
                <Field label={t.f.item}>{(id) => <Select id={id} value={l.item} placeholder="—"
                  options={products.map((p) => ({ value: p.id, label: itemName(lang, p) }))}
                  onChange={(v) => set(i, { item: v, price: price(v) })} />}</Field>
                <Field label={t.f.qty}>{(id) => <NumberInput id={id} value={l.qty} step="1" onChange={(v) => set(i, { qty: v })} />}</Field>
                <Field label={t.ics.unitPrice} hint={it && !l.price ? t.ics.noPrice : undefined}>{(id, d) => <NumberInput id={id} value={l.price} describedBy={d} onChange={(v) => set(i, { price: v })} />}</Field>
                <p className="small muted">{it ? [it.code, it.iconsiam_code, it.barcode].filter(Boolean).join(" · ") : ""}</p>
                {lines.length > 1 && <button type="button" className="btn btn--small line__remove" onClick={() => setLines(lines.filter((_, j) => j !== i))}>{t.ics.removeLine}</button>}
              </div>
            );
          })}
          <button type="button" className="btn btn--small" onClick={() => setLines([...lines, { item: "", qty: "", price: "" }])}>＋ {t.ics.addLine}</button>
        </fieldset>
        <p className="total">{t.ics.total}: {qty(units)} · {fmt(t.baht, { n: money(value) })}</p>
        <Field label={`${t.f.note} ${t.optional}`} wide>{(id) => <textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="row row--end">
          <a className="btn" href="#/iconsiam/ship">{t.cancel}</a>
          <button className="btn btn--primary" disabled={busy}>{busy ? t.saving : t.ics.savePlan}</button>
        </div>
      </form>
    </section>
  );
}

// ---------- one delivery ----------

export function ShipmentDetail({ id }: { id: string }) {
  const { t, lang, ref } = useOps();
  const root = useWorkspace();
  const q = useQuery(() => shipQuery().eq("id", id).maybeSingle() as unknown as PromiseLike<{ data: Shipment | null; error: unknown }>, [id]);
  const maps = useQuery(() => db.from("channel_item_maps").select("*").eq("channel_code", ICS.channel) as unknown as PromiseLike<{ data: ItemMap[] | null; error: unknown }>, []);
  const [docLang, setDocLang] = useState<Lang>(lang);
  const s = q.data;
  if (q.error) return <Notice kind="error">{errorText(t, q.error)}</Notice>;
  if (!s) return <p>{q.loading ? t.loading : t.errors.not_found}</p>;
  const lines = [...s.consignment_shipment_lines].sort((a, b) => a.line_no - b.line_no);
  const units = lines.reduce((n, l) => n + Number(l.qty), 0);
  const value = lines.reduce((n, l) => n + Number(l.amount ?? 0), 0);
  const gp = s.gp_percent != null ? Number(s.gp_percent) : null;
  const unreviewed = lines.filter((l) => !l.item_id || (l.map_id && maps.data?.find((m) => m.id === l.map_id)?.status !== "reviewed"));
  return (
    <section className="ics" ref={root}>
      <p><a href="#/iconsiam/ship">← {t.ics.shipTitle}</a></p>
      <div className="row row--between">
        <h1>{s.ship_no}</h1>
        <ShipStatus s={s.status} />
      </div>
      <ShipSteps s={s} />
      <dl className="facts">
        <div><dt>{t.ics.docDate}</dt><dd>{dateLabel(lang, s.doc_date)}</dd></div>
        <div><dt>{t.ics.fromLoc}</dt><dd>{ref.locations.find((l) => l.code === s.from_location)?.[lang === "th" ? "name_th" : "name_en"] ?? s.from_location}</dd></div>
        <div><dt>{t.ics.plannedDispatch}</dt><dd>{dateLabel(lang, s.planned_dispatch)}</dd></div>
        <div><dt>{t.ics.expectedArrival}</dt><dd>{dateLabel(lang, s.expected_arrival)}</dd></div>
        {s.dispatched_on && <div><dt>{t.ics.dispatchedOn}</dt><dd>{dateLabel(lang, s.dispatched_on)}{s.transfer_doc && <> · <a href={`#/record/${s.transfer_doc}`}>{t.ics.details}</a></>}</dd></div>}
        {s.received_on && <div><dt>{t.ics.receivedOn}</dt><dd>{dateLabel(lang, s.received_on)} · {t.ics.receiptStatus[s.receipt_status]}</dd></div>}
        {s.note && <div><dt>{t.f.note}</dt><dd>{s.note}</dd></div>}
        {s.receipt_note && <div><dt>{t.ics.receiptNote}</dt><dd>{s.receipt_note}</dd></div>}
      </dl>
      {s.receipt_status === "received_unsigned" && <p className="warn"><span aria-hidden="true">⚠</span> {t.ics.unsignedNote}</p>}

      <div className="scroll">
        <table className="table">
          <thead><tr>
            <th>{t.ics.colSku}</th><th>{t.icx.colStoreCode}</th><th className="n">{t.f.qty}</th><th className="n">{t.ics.unitPrice}</th><th className="n">{t.ics.amount}</th>
            {(s.status === "received" || s.status === "partly_received") && <><th className="n">{t.ics.accepted}</th><th className="n">{t.ics.rejected}</th><th className="n">{t.ics.missing}</th></>}
          </tr></thead>
          <tbody>
            {lines.map((l) => {
              const it = ref.items.find((i) => i.id === l.item_id);
              const m = maps.data?.find((x) => x.id === l.map_id);
              return (
                <tr key={l.id}>
                  <td><span className="sku"><ProductThumb code={it?.code} alt="" />
                    <span className="sku__text"><strong>{it ? itemName(lang, it) : l.description}</strong>
                      <span className="muted small">{[it?.code, l.package_size].filter(Boolean).join(" · ")}</span>
                      {(!l.item_id || (m && m.status !== "reviewed")) && <span className="tag tag--warn">{l.item_id ? t.ics.mapReview : t.ics.lineUnmapped}</span>}
                    </span></span></td>
                  <td className="mono">{[l.source_code, l.barcode].filter(Boolean).join(" · ") || "–"}</td>
                  <td className="n">{qty(l.qty)}</td>
                  <td className="n">{money(l.unit_price)}</td>
                  <td className="n">{money(l.amount)}</td>
                  {(s.status === "received" || s.status === "partly_received") && <><td className="n">{qty(l.accepted)}</td><td className="n">{qty(l.rejected)}</td><td className="n">{qty(l.missing)}</td></>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <dl className="ics__money">
        <div><dt>{t.icx.totalUnits}</dt><dd>{qty(units)}</dd></div>
        <div><dt>{t.icx.retailTotal}</dt><dd>{fmt(t.baht, { n: money(value) })}</dd></div>
        {gp != null && <div><dt>{fmt(t.ics.gpReference, { pct: qty(gp) })}</dt><dd>{fmt(t.baht, { n: money(value * gp / 100) })}</dd></div>}
        {gp != null && <div><dt>{t.ics.afterGpReference}</dt><dd>{fmt(t.baht, { n: money(value * (1 - gp / 100)) })}</dd></div>}
      </dl>
      <p className="dash__note"><Icon name="alert" size={18} /> {t.ics.gpRefNote}</p>

      {s.status === "planned" && unreviewed.length > 0 && (
        <p className="warn"><span aria-hidden="true">⚠</span> {t.errors.mapping_review} <a href="#/iconsiam/maps">{t.ics.mappings}</a></p>
      )}
      {s.status === "planned" && <PlannedActions s={s} done={q.reload} />}
      {s.status === "dispatched" && <ReceiveForm s={s} done={q.reload} />}

      <div className="panel">
        <div className="row">
          <Field label={t.ics.printLang}>{(fid) => <Select id={fid} value={docLang} onChange={(v) => setDocLang(v as Lang)} options={[{ value: "th", label: t.icx.langTh }, { value: "en", label: t.icx.langEn }]} />}</Field>
          <a className="btn" href={`#/iconsiam/print/${s.id}?doc=delivery&lang=${docLang}`}><Icon name="print" /> {t.ics.printDelivery}</a>
          <a className="btn" href={`#/iconsiam/print/${s.id}?doc=card&lang=${docLang}`}><Icon name="print" /> {t.ics.printCard}</a>
        </div>
      </div>
    </section>
  );
}

/** Plan → dispatch → receive, with the dates that are known. */
function ShipSteps({ s }: { s: Shipment }) {
  const { t, lang } = useOps();
  const done = { plan: true, dispatch: !!s.dispatched_on, receive: !!s.received_on };
  const steps = [
    { key: "plan", label: t.ics.shipStatus.planned, date: s.planned_dispatch ?? s.doc_date, ok: done.plan },
    { key: "dispatch", label: t.ics.tlDispatch, date: s.dispatched_on ?? s.planned_dispatch, ok: done.dispatch },
    { key: "receive", label: t.ics.tlReceive, date: s.received_on ?? s.expected_arrival, ok: done.receive },
  ];
  if (s.status === "cancelled") return <p className="notice notice--info">{t.ics.shipStatus.cancelled}</p>;
  return (
    <ol className="shipsteps">
      {steps.map((x, i) => (
        <li key={x.key} className={x.ok ? "shipsteps__step is-done" : "shipsteps__step"} style={{ ["--i" as string]: i }}>
          <span className="shipsteps__dot" aria-hidden="true">{x.ok ? <Icon name="check" size={16} /> : i + 1}</span>
          <span>{x.label}<br /><small className="muted">{dateLabel(lang, x.date)}</small></span>
        </li>
      ))}
    </ol>
  );
}

function PlannedActions({ s, done }: { s: Shipment; done: () => void }) {
  const { t } = useOps();
  const [date, setDate] = useState(today);
  const [eta, setEta] = useState(s.expected_arrival ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const run = async (fn: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setBusy(true); setError(null);
    const { error: err } = await fn();
    setBusy(false);
    if (err) setError(errorText(t, err)); else { toast.show(ok); done(); }
  };
  return (
    <div className="ship-actions">
      <form className="card form" onSubmit={(e) => { e.preventDefault(); run(() => db.rpc("dispatch_shipment", { p_id: s.id, p_date: date, p_expected: eta || null }), t.ics.saved); }}>
        <h2><Icon name="truck" /> {t.ics.dispatch}</h2>
        <p className="small muted">{t.ics.dispatchHint}</p>
        <div className="grid">
          <Field label={t.ics.dispatchedOn}>{(id) => <input id={id} type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label={t.ics.expectedArrival}>{(id) => <input id={id} type="date" value={eta} min={date} onChange={(e) => setEta(e.target.value)} />}</Field>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <button className="btn btn--primary" disabled={busy}>{busy ? t.ics.working : t.ics.dispatch}</button>
      </form>
      <details className="card subform">
        <summary>{t.ics.cancel}</summary>
        <Field label={t.ics.cancelReason}>{(id) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        <button type="button" className="btn btn--danger" disabled={busy} onClick={() => run(() => db.rpc("cancel_shipment", { p_id: s.id, p_reason: reason }), t.ics.saved)}>{t.ics.cancel}</button>
      </details>
      {toast.node}
    </div>
  );
}

function ReceiveForm({ s, done }: { s: Shipment; done: () => void }) {
  const { t, ref, lang } = useOps();
  const lines = [...s.consignment_shipment_lines].sort((a, b) => a.line_no - b.line_no);
  const [date, setDate] = useState(today);
  const [vals, setVals] = useState<Record<string, { accepted: string; rejected: string; missing: string }>>(
    () => Object.fromEntries(lines.map((l) => [l.id, { accepted: String(Number(l.qty)), rejected: "0", missing: "0" }])));
  const [signed, setSigned] = useState(false);
  const [receiver, setReceiver] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const short = lines.some((l) => Number(vals[l.id].accepted) !== Number(l.qty));
  const submit = async () => {
    setBusy(true); setError(null);
    const { error: err } = await db.rpc("receive_shipment", { p: {
      id: s.id, date, signed, note, signatures: receiver ? { receiver_name: receiver } : {},
      lines: Object.fromEntries(lines.map((l) => [l.id, { accepted: Number(vals[l.id].accepted || 0), rejected: Number(vals[l.id].rejected || 0), missing: Number(vals[l.id].missing || 0) }])),
    } });
    setBusy(false);
    if (err) setError(errorText(t, err)); else done();
  };
  return (
    <form className="card form" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
      <h2><Icon name="box" /> {t.ics.receive}</h2>
      <p className="small muted">{t.ics.rejectedNote}</p>
      <Field label={t.ics.receivedOn}>{(id) => <input id={id} type="date" value={date} min={s.dispatched_on ?? undefined} max={today()} onChange={(e) => setDate(e.target.value)} />}</Field>
      <div className="scroll">
        <table className="table">
          <thead><tr><th>{t.ics.colSku}</th><th className="n">{t.f.qty}</th><th className="n">{t.ics.accepted}</th><th className="n">{t.ics.rejected}</th><th className="n">{t.ics.missing}</th></tr></thead>
          <tbody>
            {lines.map((l) => {
              const it = ref.items.find((i) => i.id === l.item_id);
              const name = it ? itemName(lang, it) : l.description ?? "";
              const v = vals[l.id];
              const cell = (k: "accepted" | "rejected" | "missing", label: string) => (
                <td className="n"><input type="number" inputMode="numeric" min="0" step="1" className="cell" aria-label={`${label} ${name}`} value={v[k]}
                  onChange={(e) => setVals({ ...vals, [l.id]: { ...v, [k]: e.target.value } })} /></td>
              );
              return (
                <tr key={l.id}>
                  <td>{name}</td><td className="n">{qty(l.qty)}</td>
                  {cell("accepted", t.ics.accepted)}{cell("rejected", t.ics.rejected)}{cell("missing", t.ics.missing)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="check"><input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} /> {t.ics.signed}</label>
      {!signed && <p className="warn"><span aria-hidden="true">⚠</span> {t.ics.unsignedNote}</p>}
      <Field label={`${t.ics.receiverName} ${t.optional}`}>{(id) => <input id={id} value={receiver} onChange={(e) => setReceiver(e.target.value)} />}</Field>
      <Field label={t.ics.receiptNote} hint={short ? t.errors.reason_required : undefined}>{(id, d) => <input id={id} value={note} aria-describedby={d} onChange={(e) => setNote(e.target.value)} />}</Field>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row row--end"><button className="btn btn--primary" disabled={busy}>{busy ? t.ics.working : t.ics.receive}</button></div>
    </form>
  );
}

// ---------- printable delivery note (4 copies) and stock card (1 copy) ----------

export function PrintView({ id, params }: { id: string; params: URLSearchParams }) {
  const { t, ref } = useOps();
  const docLang = (params.get("lang") === "en" ? "en" : "th") as Lang;
  const kind = params.get("doc") === "card" ? "card" : "delivery";
  const x = opsText[docLang];
  const q = useQuery(() => shipQuery().eq("id", id).maybeSingle() as unknown as PromiseLike<{ data: Shipment | null; error: unknown }>, [id]);
  const prof = useQuery(() => db.from("channel_profiles").select("*").eq("channel_code", ICS.channel).maybeSingle() as unknown as PromiseLike<{ data: ChannelProfile | null; error: unknown }>, []);
  const s = q.data, p = prof.data;
  useEffect(() => { document.body.classList.add("printing"); return () => document.body.classList.remove("printing"); }, []);
  if (q.error || prof.error) return <Notice kind="error">{errorText(t, q.error ?? prof.error)}</Notice>;
  if (!s) return <p>{t.loading}</p>;
  const copies = kind === "card" ? p?.stock_card_copies ?? 1 : p?.delivery_copies ?? 4;
  const lines = [...s.consignment_shipment_lines].sort((a, b) => a.line_no - b.line_no);
  const units = lines.reduce((n, l) => n + Number(l.qty), 0);
  const value = lines.reduce((n, l) => n + Number(l.amount ?? 0), 0);
  const gp = s.gp_percent != null ? Number(s.gp_percent) : null;
  const d = (v: string | null) => dateLabel(docLang, v);
  const nm = (lid: string | null) => { const it = ref.items.find((i) => i.id === lid); return it ? (docLang === "th" ? it.name_th : it.name_en) : null; };
  return (
    <section className="print">
      <div className="print__bar no-print">
        <a href={`#/iconsiam/ship/${s.id}`}>← {t.ics.back}</a>
        <button type="button" className="btn btn--primary" onClick={() => print()}><Icon name="print" /> {t.ics.print}</button>
        <span className="small muted">{x.ics.gpRefNote}</span>
      </div>
      {Array.from({ length: copies }, (_, c) => (
        <article className="sheet" key={c} lang={docLang}>
          <header className="sheet__head">
            <div>
              <h1>{kind === "card" ? x.icx.docCard : x.icx.docDelivery}</h1>
              <p className="small">{fmt(x.icx.copyOf, { n: c + 1, total: copies })}</p>
            </div>
            <dl className="sheet__meta">
              <div><dt>{x.icx.docNo}</dt><dd className="mono">{s.ship_no}</dd></div>
              <div><dt>{x.ics.docDate}</dt><dd>{d(s.doc_date)}</dd></div>
              <div><dt>{x.ics.expectedArrival}</dt><dd>{d(s.expected_arrival ?? s.planned_dispatch)}</dd></div>
            </dl>
          </header>
          <div className="sheet__parties">
            <div>
              <h2>{x.ics.supplier}</h2>
              <p>{p?.supplier.name}<br />{p?.supplier.address}<br />{[p?.supplier.phone, p?.supplier.email].filter(Boolean).join(" · ")}</p>
              <p>{x.ics.fVendor}: <strong className="mono">{p?.supplier.vendor_no ?? "–"}</strong>{p?.supplier.vat_note ? <> · {p.supplier.vat_note}</> : null}</p>
            </div>
            <div>
              <h2>{x.ics.customer}</h2>
              <p>{p?.customer.name}<br />{p?.customer.address}</p>
              <p>{p?.customer.tax_id && <>{x.ics.fTax}: <span className="mono">{p.customer.tax_id}</span><br /></>}
                {[p?.customer.store && `${x.ics.fStore}: ${p.customer.store}`, p?.customer.floor && `${x.ics.fFloor}: ${p.customer.floor}`].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <table className="sheet__table">
            <thead><tr>
              <th>{x.icx.lineNo}</th><th>{x.icx.colPicture}</th><th>{x.icx.colCode}</th><th>{x.icx.colStoreCode}</th><th>{x.icx.colDesc}</th>
              <th className="n">{x.f.qty}</th>
              {kind === "delivery" ? <><th className="n">{x.ics.unitPrice}</th><th className="n">{x.ics.amount}</th></>
                : <><th className="n">{x.ics.accepted}</th><th>{x.icx.sigReceiver}</th></>}
            </tr></thead>
            <tbody>
              {lines.map((l) => {
                const it = ref.items.find((i) => i.id === l.item_id);
                return (
                  <tr key={l.id}>
                    <td>{l.line_no}</td>
                    <td><ProductThumb code={it?.code} alt="" size={36} eager /></td>
                    <td className="mono">{it?.code ?? "–"}</td>
                    <td className="mono">{l.source_code ?? "–"}<br /><small>{l.barcode ?? ""}</small></td>
                    <td>{nm(l.item_id) ?? l.description}{l.package_size ? ` · ${l.package_size}` : ""}</td>
                    <td className="n">{qty(l.qty)}</td>
                    {kind === "delivery" ? <><td className="n">{money(l.unit_price)}</td><td className="n">{money(l.amount)}</td></>
                      : <><td className="n">{l.accepted != null ? qty(l.accepted) : ""}</td><td /></>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr><th colSpan={5}>{x.icx.totalUnits}</th><th className="n">{qty(units)}</th>{kind === "delivery" ? <><th>{x.icx.retailTotal}</th><th className="n">{money(value)}</th></> : <><th /><th /></>}</tr>
              {kind === "delivery" && gp != null && <>
                <tr><td colSpan={7}>{fmt(x.ics.gpReference, { pct: qty(gp) })}</td><td className="n">{money(value * gp / 100)}</td></tr>
                <tr><td colSpan={7}>{x.ics.afterGpReference}</td><td className="n">{money(value * (1 - gp / 100))}</td></tr>
              </>}
            </tfoot>
          </table>
          {kind === "delivery" && <p className="small">{x.ics.gpRefNote}</p>}
          <div className="sheet__sign">
            {[x.icx.sigSender, x.icx.sigReceiver].map((who) => (
              <div key={who}><span className="sheet__line" /><p>{who}</p><p>{x.icx.sigDate} ____/____/______</p></div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

// ---------- code mappings (owner reviews) ----------

export function MapsPage() {
  const { t, ref, lang } = useOps();
  const root = useWorkspace();
  const q = useQuery(() => db.from("channel_item_maps").select("*").eq("channel_code", ICS.channel).order("source_code") as unknown as PromiseLike<{ data: ItemMap[] | null; error: unknown }>, []);
  const products = ref.items.filter((i) => i.kind === "product");
  const order = { needs_review: 0, proposed: 1, reviewed: 2, rejected: 3 };
  return (
    <section className="ics" ref={root}>
      <Back />
      <h1>{t.ics.mapTitle}</h1>
      <p className="notice notice--info">{t.ics.mapIntro}</p>
      {!ref.isOwner && <p className="muted">{t.ics.ownerOnly}</p>}
      {q.error ? <Notice kind="error">{errorText(t, q.error)}</Notice> : !q.data ? <p>{t.loading}</p> : (
        <ul className="maps">
          {[...q.data].sort((a, b) => order[a.status] - order[b.status]).map((m) => (
            <MapRow key={m.id} m={m} products={products.map((p) => ({ value: p.id, label: `${itemName(lang, p)} · ${p.code}` }))} done={q.reload} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MapRow({ m, products, done }: { m: ItemMap; products: { value: string; label: string }[]; done: () => void }) {
  const { t, ref, lang } = useOps();
  const [item, setItem] = useState(m.item_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const it = ref.items.find((i) => i.id === m.item_id);
  const issues = t.ics.mapIssue as Record<string, string>;
  const review = async (status: "reviewed" | "rejected") => {
    setBusy(true); setError(null);
    const { error: err } = await db.rpc("review_item_map", { p: { id: m.id, status, item_id: status === "reviewed" ? item : null } });
    setBusy(false);
    if (err) setError(errorText(t, err)); else done();
  };
  return (
    <li className={`map map--${m.status}`}>
      <div className="map__head">
        <span className="mono"><strong>{m.source_code}</strong>{m.barcode ? ` · ${m.barcode}` : ""}</span>
        <span className={`tag ${m.status === "reviewed" ? "tag--ok" : m.status === "needs_review" ? "tag--warn" : ""}`}>{t.ics.mapStatus[m.status]}</span>
      </div>
      <p>{m.source_name}{m.package_size ? ` · ${m.package_size}` : ""} → <strong>{it ? itemName(lang, it) : "–"}</strong></p>
      {m.issues.length > 0 && <ul className="plain small">{m.issues.map((k) => <li key={k} className="map__issue"><span aria-hidden="true">⚠</span> {issues[k] ?? k}</li>)}</ul>}
      {ref.isOwner && m.status !== "reviewed" && (
        <div className="row">
          <Field label={t.ics.mapItem}>{(id) => <Select id={id} value={item} onChange={setItem} placeholder="—" options={products} />}</Field>
          <button type="button" className="btn btn--primary" disabled={busy || !item} onClick={() => review("reviewed")}>{t.ics.mapConfirm}</button>
          {m.status !== "rejected" && <button type="button" className="btn" disabled={busy} onClick={() => review("rejected")}>{t.ics.mapReject}</button>}
        </div>
      )}
      {error && <Notice kind="error">{error}</Notice>}
    </li>
  );
}

// ---------- document details (owner) ----------

export function ProfilePage() {
  const { t, ref } = useOps();
  const root = useWorkspace();
  const q = useQuery(() => db.from("channel_profiles").select("*").eq("channel_code", ICS.channel).maybeSingle() as unknown as PromiseLike<{ data: ChannelProfile | null; error: unknown }>, []);
  if (!ref.isOwner) return <section className="ics"><Back /><p className="muted">{t.errors.owner_only}</p></section>;
  if (q.error) return <Notice kind="error">{errorText(t, q.error)}</Notice>;
  if (q.loading) return <p>{t.loading}</p>;
  return <section className="ics" ref={root}><Back /><h1>{t.ics.profileTitle}</h1><ProfileForm p={q.data} /></section>;
}

function ProfileForm({ p }: { p: ChannelProfile | null }) {
  const { t } = useOps();
  const [sup, setSup] = useState({ name: "", vendor_no: "", address: "", phone: "", email: "", vat_note: "", ...p?.supplier });
  const [cus, setCus] = useState({ name: "", address: "", tax_id: "", store: "", floor: "", ...p?.customer });
  const [gp, setGp] = useState(p?.gp_percent != null ? String(p.gp_percent) : "");
  const [copies, setCopies] = useState(String(p?.delivery_copies ?? 4));
  const [cardCopies, setCardCopies] = useState(String(p?.stock_card_copies ?? 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const save = async () => {
    setBusy(true); setError(null);
    const { error: err } = await db.rpc("save_channel_profile", { p: { channel: ICS.channel, supplier: sup, customer: cus, gp_percent: gp, delivery_copies: copies, stock_card_copies: cardCopies } });
    setBusy(false);
    if (err) setError(errorText(t, err)); else toast.show(t.ics.saved);
  };
  const text = <T extends Record<string, string>>(obj: T, setObj: (v: T) => void, k: keyof T & string, label: string, wide = false) => (
    <Field label={label} wide={wide}>{(id) => <input id={id} value={obj[k]} onChange={(e) => setObj({ ...obj, [k]: e.target.value })} />}</Field>
  );
  return (
    <form className="card form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <fieldset className="lines"><legend>{t.ics.supplier}</legend><div className="grid">
        {text(sup, setSup, "name", t.ics.fName)}{text(sup, setSup, "vendor_no", t.ics.fVendor)}{text(sup, setSup, "address", t.ics.fAddress, true)}
        {text(sup, setSup, "phone", t.ics.fPhone)}{text(sup, setSup, "email", t.ics.fEmail)}{text(sup, setSup, "vat_note", t.ics.fVat, true)}
      </div></fieldset>
      <fieldset className="lines"><legend>{t.ics.customer}</legend><div className="grid">
        {text(cus, setCus, "name", t.ics.fName, true)}{text(cus, setCus, "address", t.ics.fAddress, true)}
        {text(cus, setCus, "tax_id", t.ics.fTax)}{text(cus, setCus, "store", t.ics.fStore)}{text(cus, setCus, "floor", t.ics.fFloor)}
      </div></fieldset>
      <div className="grid">
        <Field label={t.ics.fGp}>{(id) => <NumberInput id={id} value={gp} onChange={setGp} />}</Field>
        <Field label={t.ics.fCopies}>{(id) => <NumberInput id={id} value={copies} step="1" onChange={setCopies} />}</Field>
        <Field label={t.ics.fCardCopies}>{(id) => <NumberInput id={id} value={cardCopies} step="1" onChange={setCardCopies} />}</Field>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row row--end"><button className="btn btn--primary" disabled={busy}>{busy ? t.saving : t.ics.save}</button></div>
      {toast.node}
    </form>
  );
}
