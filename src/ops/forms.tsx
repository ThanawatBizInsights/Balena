// Record forms. Each builds one post_document() payload; the database checks it, decides on
// approval and writes the ledgers. A form keeps one client key until it saves, so pressing Save
// twice (or a retry after a dropped connection) never creates two records.
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  db, errorText, fmt, inCategory, money, newKey, priceFor, qty as fq, seesMoney, today, uploadReceipt,
  type DocType, type Doc, type Item, type OpenRecord, type StockRow,
} from "./api";
import { Field, NumberInput, Notice, Select, StockLineFields, blankStockLine, itemName, linePayload, unitLabel, useItemOptions, useNames, useOps, type StockLine } from "./ui";

const STAFF_TYPES: DocType[] = ["sale", "production", "transfer", "count", "adjustment"];
const ALL_TYPES: DocType[] = ["sale", "expense", "purchase", "production", "transfer", "count", "adjustment", "consignment", "payment", "partner", "opening"];
const CATEGORIES = ["rent", "utilities", "wages", "advertising", "delivery", "platform_fees", "supplies", "equipment", "other"] as const;

export function NewRecord() {
  const { t, ref } = useOps();
  const types = ref.me.role === "staff" ? STAFF_TYPES : ALL_TYPES;
  return (
    <section>
      <h1>{t.nav.new}</h1>
      <ul className="tiles">
        {types.map((k) => (
          <li key={k}><a className="tile" href={`#/new/${k}`}><strong>{k === "consignment" ? t.imp.title : t.types[k]}</strong><span>{t.typeHints[k]}</span></a></li>
        ))}
      </ul>
    </section>
  );
}

export function RecordForm({ type }: { type: string }) {
  const { t, ref } = useOps();
  const allowed = ref.me.role === "staff" ? STAFF_TYPES : ALL_TYPES;
  if (!allowed.includes(type as DocType)) return <Notice kind="error">{t.errors.not_allowed}</Notice>;
  const forms: Record<Exclude<DocType, "consumption">, () => ReactNode> = {
    sale: () => <SaleForm />,
    expense: () => <ExpenseForm />,
    purchase: () => <PurchaseForm />,
    production: () => <ProductionForm />,
    adjustment: () => <AdjustmentForm />,
    transfer: () => <TransferForm />,
    count: () => <CountForm />,
    consignment: () => <ConsignmentForm />,
    payment: () => <PaymentForm />,
    partner: () => <PartnerForm />,
    opening: () => <OpeningForm />,
  };
  return (
    <section>
      <p><a href="#/new">← {t.back}</a></p>
      <h1>{type === "consignment" ? t.imp.title : t.types[type as DocType]}</h1>
      {forms[type as Exclude<DocType, "consumption">]()}
    </section>
  );
}

// ---------- shared form machinery ----------

type Payload = { doc_type: DocType; doc_date: string; location_code?: string | null; total?: number; data?: Record<string, unknown>; lines?: Record<string, unknown>[]; attachments?: string[]; note?: string };

function usePost() {
  const { t, go } = useOps();
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const post = async (build: () => Promise<Payload> | Payload) => {
    setBusy(true); setError(null);
    try {
      const p = await build();
      const { data, error: err } = await db.rpc("post_document", { p: { ...p, client_key: key } });
      if (err) throw err;
      setKey(newKey());
      go(`/record/${(data as Doc).id}/new`);
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };
  return { post, busy, error };
}

function FormShell({ onSubmit, busy, error, children, footer, submitLabel }: { onSubmit: () => void; busy: boolean; error: string | null; children: ReactNode; footer?: ReactNode; submitLabel?: string }) {
  const { t } = useOps();
  return (
    <form className="card form" onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(); }} noValidate>
      <div className="grid">{children}</div>
      {footer}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row row--end">
        <a className="btn" href="#/new">{t.cancel}</a>
        <button className="btn btn--primary" disabled={busy}>{busy ? t.saving : submitLabel ?? t.save}</button>
      </div>
    </form>
  );
}

function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useOps();
  return <Field label={t.f.date}>{(id) => <input id={id} type="date" required max={today()} value={value} onChange={(e) => onChange(e.target.value)} />}</Field>;
}

function useLocationOptions(kinds: ("own" | "consignment")[] = ["own"]) {
  const { ref, lang } = useOps();
  return ref.locations.filter((l) => l.active && kinds.includes(l.kind as "own")).map((l) => ({ value: l.code, label: lang === "th" ? l.name_th : l.name_en }));
}

function LocationField({ value, onChange, label, kinds, exclude }: { value: string; onChange: (v: string) => void; label?: string; kinds?: ("own" | "consignment")[]; exclude?: string }) {
  const { t } = useOps();
  const opts = useLocationOptions(kinds).filter((o) => o.value !== exclude);
  return <Field label={label ?? t.f.location}>{(id) => <Select id={id} value={value} onChange={onChange} options={opts} placeholder="—" />}</Field>;
}

function useHomeLocation() {
  const { ref } = useOps();
  const home = ref.me.home_location;
  return ref.locations.some((l) => l.code === home && l.kind === "own") ? home! : "CK";
}

/** Who paid: an account, a partner's own money, or not paid yet. */
function usePaidOptions(withMembers: boolean, withUnpaid: boolean) {
  const { t, ref } = useOps();
  return [
    ...ref.accounts.filter((a) => a.active).map((a) => ({ value: a.code, label: a.name })),
    ...(withMembers ? ref.members.filter((m) => m.active && m.role !== "staff").map((m) => ({ value: `member:${m.id}`, label: fmt(t.f.paidPersonally, { name: m.display_name }) })) : []),
    ...(withUnpaid ? [{ value: "unpaid", label: t.f.unpaid }] : []),
  ];
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));


function Receipt({ files, setFiles, reason, setReason }: { files: File[]; setFiles: (f: File[]) => void; reason: string; setReason: (s: string) => void }) {
  const { t } = useOps();
  return (
    <>
      <Field label={t.f.receipt} wide>
        {(id, d) => <input id={id} type="file" accept="image/*,application/pdf" multiple aria-describedby={d} onChange={(e) => setFiles([...(e.target.files ?? [])])} />}
      </Field>
      {files.length === 0 && (
        <Field label={t.f.noReceipt} hint={t.f.noReceiptHint} wide>
          {(id, d) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby={d} />}
        </Field>
      )}
    </>
  );
}

function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useOps();
  return <Field label={`${t.f.note} ${t.optional}`} wide>{(id) => <textarea id={id} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />}</Field>;
}

/** Editable list of lines. */
function Lines<L>({ rows, setRows, blank, render, title }: { rows: L[]; setRows: (r: L[]) => void; blank: () => L; render: (row: L, set: (patch: Partial<L>) => void, i: number) => ReactNode; title: string }) {
  const { t } = useOps();
  return (
    <fieldset className="lines field--wide">
      <legend>{title}</legend>
      {rows.map((row, i) => (
        <div className="line" key={i}>
          {render(row, (patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))), i)}
          {rows.length > 1 && (
            <button type="button" className="link line__remove" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`${t.remove} ${i + 1}`}>
              {t.remove}
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn--small" onClick={() => setRows([...rows, blank()])}>{t.f.addLine}</button>
    </fieldset>
  );
}

function useOnHand(location: string) {
  const [rows, setRows] = useState<StockRow[]>([]);
  useEffect(() => {
    if (!location) { setRows([]); return; }
    db.from("stock_on_hand").select("*").eq("location_code", location).then(({ data }) => setRows((data ?? []) as StockRow[]));
  }, [location]);
  return (itemId: string) => Number(rows.find((r) => r.item_id === itemId)?.qty ?? 0);
}

// ---------- sale ----------

type SaleLine = { item: string; qty: string; price: string; discount: string };

function SaleForm() {
  const { t, ref } = useOps();
  const { post, busy, error } = usePost();
  const [date, setDate] = useState(today);
  const [loc, setLoc] = useState(useHomeLocation());
  const [channel, setChannel] = useState("SHOP-CK");
  const [paid, setPaid] = useState("CASH-CK");
  const [orderRef, setOrderRef] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<SaleLine[]>([{ item: "", qty: "1", price: "", discount: "" }]);
  const products = useItemOptions(["product"]);
  const onHand = useOnHand(loc);
  const channels = ref.channels.filter((c) => c.active && c.kind !== "consignment").map((c) => ({ value: c.code, label: c.name }));
  const paidOpts = [
    ...ref.accounts.filter((a) => a.active).map((a) => ({ value: a.code, label: a.name })),
    { value: "payout", label: t.f.payout },
    { value: "unpaid", label: t.f.unpaidSale },
  ];
  const onChannel = (c: string) => {
    setChannel(c);
    const kind = ref.channels.find((x) => x.code === c)?.kind;
    setPaid(kind === "shop" ? "CASH-CK" : "payout");
    setRows(rows.map((r) => ({ ...r, price: r.item ? String(priceFor(ref, r.item, c, date) ?? r.price) : r.price })));
  };
  const total = rows.reduce((s, r) => s + (num(r.qty) || 0) * (num(r.price) || 0) - (num(r.discount) || 0), 0);

  return (
    <FormShell busy={busy} error={error}
      onSubmit={() => post(() => ({
        doc_type: "sale", doc_date: date, location_code: loc, note,
        data: { channel, paid, ...(orderRef.trim() ? { order_ref: orderRef.trim() } : {}) },
        lines: rows.map((r) => ({ item_id: r.item || null, qty: num(r.qty), unit_price: num(r.price), ...(r.discount ? { discount: num(r.discount) } : {}) })),
      }))}
      footer={<p className="total">{t.f.total}: <strong>{fmt(t.baht, { n: money(total) })}</strong></p>}>
      <DateField value={date} onChange={setDate} />
      <LocationField value={loc} onChange={setLoc} />
      <Field label={t.f.channel}>{(id) => <Select id={id} value={channel} onChange={onChannel} options={channels} />}</Field>
      <Field label={t.f.paid}>{(id) => <Select id={id} value={paid} onChange={setPaid} options={paidOpts} />}</Field>
      <Field label={`${t.f.orderRef} ${t.optional}`}>{(id) => <input id={id} value={orderRef} onChange={(e) => setOrderRef(e.target.value)} />}</Field>
      <Lines title={t.records.lines} rows={rows} setRows={setRows} blank={() => ({ item: "", qty: "1", price: "", discount: "" })}
        render={(r, set) => (
          <>
            <Field label={t.f.product}>{(id) => <Select id={id} value={r.item} placeholder="—" options={products}
              onChange={(v) => set({ item: v, price: String(priceFor(ref, v, channel, date) ?? r.price) })} />}</Field>
            <Field label={t.f.qty} hint={r.item ? fmt(t.f.onHand, { n: fq(onHand(r.item)) }) : undefined}>
              {(id, d) => <NumberInput id={id} value={r.qty} onChange={(v) => set({ qty: v })} step="1" describedBy={d} />}
            </Field>
            <Field label={t.f.unitPrice}>{(id) => <NumberInput id={id} value={r.price} onChange={(v) => set({ price: v })} />}</Field>
            <Field label={`${t.f.discount} ${t.optional}`}>{(id) => <NumberInput id={id} value={r.discount} onChange={(v) => set({ discount: v })} />}</Field>
            {r.item && num(r.qty) > onHand(r.item) && (
              <p className="field--wide warn" role="status"><span aria-hidden="true">⚠</span> {t.inv.negWarn} {fmt(t.inv.after, { n: fq(onHand(r.item) - num(r.qty)) })}</p>
            )}
          </>
        )} />
      <NoteField value={note} onChange={setNote} />
    </FormShell>
  );
}

// ---------- expense ----------

function ExpenseForm() {
  const { t } = useOps();
  const { post, busy, error } = usePost();
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [supplier, setSupplier] = useState("");
  const [loc, setLoc] = useState("");
  const [paid, setPaid] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const paidOpts = usePaidOptions(true, true);
  const locOpts = useLocationOptions(["own", "consignment"]);
  return (
    <FormShell busy={busy} error={error} onSubmit={() => post(async () => ({
      doc_type: "expense", doc_date: date, location_code: loc || null, total: num(amount), note,
      attachments: await Promise.all(files.map(uploadReceipt)),
      data: { category, paid, ...(supplier.trim() ? { supplier: supplier.trim() } : {}), ...(files.length === 0 && reason.trim() ? { no_receipt_reason: reason.trim() } : {}) },
    }))}>
      <DateField value={date} onChange={setDate} />
      <Field label={t.f.category}>{(id) => <Select id={id} value={category} onChange={setCategory} placeholder="—" options={CATEGORIES.map((c) => ({ value: c, label: t.categories[c] }))} />}</Field>
      <Field label={t.f.amount}>{(id) => <NumberInput id={id} value={amount} onChange={setAmount} />}</Field>
      <Field label={t.f.paidBy}>{(id) => <Select id={id} value={paid} onChange={setPaid} placeholder="—" options={paidOpts} />}</Field>
      <Field label={`${t.f.supplier} ${t.optional}`}>{(id) => <input id={id} value={supplier} onChange={(e) => setSupplier(e.target.value)} />}</Field>
      <Field label={`${t.f.location} ${t.optional}`}>{(id) => <Select id={id} value={loc} onChange={setLoc} placeholder={t.none} options={locOpts} />}</Field>
      <Receipt files={files} setFiles={setFiles} reason={reason} setReason={setReason} />
      <NoteField value={note} onChange={setNote} />
    </FormShell>
  );
}

// ---------- purchase (materials, packaging, consumables or products) ----------

type BuyLine = StockLine & { amount: string };
const blankBuy = (): BuyLine => ({ ...blankStockLine(), amount: "" });

function PurchaseForm() {
  const { t } = useOps();
  const { post, busy, error } = usePost();
  const [date, setDate] = useState(today);
  const [loc, setLoc] = useState(useHomeLocation());
  const [supplier, setSupplier] = useState("");
  const [shipping, setShipping] = useState("");
  const [paid, setPaid] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<BuyLine[]>([blankBuy()]);
  const paidOpts = usePaidOptions(true, true);
  const onHand = useOnHand(loc);
  const total = rows.reduce((s, r) => s + (num(r.amount) || 0), 0) + (num(shipping) || 0);
  return (
    <FormShell busy={busy} error={error}
      footer={<p className="total">{t.f.total}: <strong>{fmt(t.baht, { n: money(total) })}</strong></p>}
      onSubmit={() => post(async () => ({
        doc_type: "purchase", doc_date: date, location_code: loc, note,
        attachments: await Promise.all(files.map(uploadReceipt)),
        data: { supplier: supplier.trim(), paid, ...(shipping ? { shipping: num(shipping) } : {}), ...(files.length === 0 && reason.trim() ? { no_receipt_reason: reason.trim() } : {}) },
        lines: rows.map((r) => linePayload(r, { amount: num(r.amount) })),
      }))}>
      <DateField value={date} onChange={setDate} />
      <LocationField value={loc} onChange={setLoc} />
      <Field label={t.f.supplier}>{(id) => <input id={id} value={supplier} onChange={(e) => setSupplier(e.target.value)} />}</Field>
      <Field label={t.f.paidBy}>{(id) => <Select id={id} value={paid} onChange={setPaid} placeholder="—" options={paidOpts} />}</Field>
      <Lines title={t.records.lines} rows={rows} setRows={setRows} blank={blankBuy}
        render={(r, set) => (
          <>
            <StockLineFields line={r} set={set} onHand={onHand} />
            <Field label={t.f.lineAmount}>{(id) => <NumberInput id={id} value={r.amount} onChange={(v) => set({ amount: v })} />}</Field>
          </>
        )} />
      <Field label={`${t.f.shipping} ${t.optional}`}>{(id) => <NumberInput id={id} value={shipping} onChange={setShipping} />}</Field>
      <Receipt files={files} setFiles={setFiles} reason={reason} setReason={setReason} />
      <NoteField value={note} onChange={setNote} />
    </FormShell>
  );
}

// ---------- production: record output now, materials now or later ----------

const INPUT_KINDS: Item["kind"][] = ["green_bean", "roasted_bean", "ingredient", "packaging", "consumable"];

function ProductionForm() {
  const { t } = useOps();
  const { post, busy, error } = usePost();
  const [date, setDate] = useState(today);
  const [loc, setLoc] = useState(useHomeLocation());
  const [kind, setKind] = useState<"roast" | "pack" | "brew">("brew");
  const [out, setOut] = useState<StockLine>(blankStockLine());
  const [inputs, setInputs] = useState<StockLine[]>([]);
  const [note, setNote] = useState("");
  const onHand = useOnHand(loc);
  const outKinds: Item["kind"][] = kind === "roast" ? ["roasted_bean"] : ["product"];
  const used = inputs.filter((r) => r.item);
  return (
    <FormShell busy={busy} error={error} submitLabel={t.batch.recordOutput}
      footer={<p className="muted">{used.length ? null : t.batch.outputHint}</p>}
      onSubmit={() => post(() => ({
        doc_type: "production", doc_date: date, location_code: loc, note, data: { kind },
        lines: [...used.map((r) => linePayload(r, { dir: "in" })), linePayload(out, { dir: "out" })],
      }))}>
      <DateField value={date} onChange={setDate} />
      <LocationField value={loc} onChange={setLoc} />
      <Field label={t.f.kind}>{(id) => <Select id={id} value={kind} onChange={(v) => { setKind(v as typeof kind); setOut(blankStockLine()); }}
        options={(["brew", "pack", "roast"] as const).map((k) => ({ value: k, label: t.production[k] }))} />}</Field>
      <fieldset className="lines field--wide">
        <legend>{t.f.output}</legend>
        <div className="line"><StockLineFields line={out} set={(p) => setOut({ ...out, ...p })} kinds={outKinds} /></div>
      </fieldset>
      <fieldset className="lines field--wide">
        <legend>{t.batch.materials}</legend>
        {inputs.map((r, i) => (
          <div className="line" key={i}>
            <StockLineFields line={r} set={(p) => setInputs(inputs.map((x, j) => (j === i ? { ...x, ...p } : x)))}
              kinds={kind === "roast" ? ["green_bean"] : INPUT_KINDS} onHand={onHand} issue warnGreen={kind !== "roast"} />
            <button type="button" className="link line__remove" onClick={() => setInputs(inputs.filter((_, j) => j !== i))}>{t.remove}</button>
          </div>
        ))}
        <button type="button" className="btn btn--small" onClick={() => setInputs([...inputs, blankStockLine()])}>{t.f.addLine}</button>
      </fieldset>
      <NoteField value={note} onChange={setNote} />
    </FormShell>
  );
}

/** Add materials to a saved batch: "Save for later" keeps it open; the batch page has "Complete batch". */
export function BatchConsumption({ batchId, kind, location, onSaved }: { batchId: string; kind: string; location: string; onSaved: () => void }) {
  const { t } = useOps();
  const [key, setKey] = useState(newKey);
  const [rows, setRows] = useState<StockLine[]>([blankStockLine()]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const onHand = useOnHand(location);
  const save = async () => {
    setBusy(true); setMsg(null);
    const { data, error } = await db.rpc("add_batch_consumption", { p: {
      client_key: key, batch_id: batchId, note, lines: rows.filter((r) => r.item || r.qty).map((r) => linePayload(r)),
    } });
    setBusy(false);
    if (error) { setMsg({ kind: "error", text: errorText(t, error) }); return; }
    setKey(newKey()); setRows([blankStockLine()]); setNote("");
    setMsg({ kind: "ok", text: fmt(t.batch.saved, { no: (data as Doc).doc_no }) });
    onSaved();
  };
  return (
    <form className="card form" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
      <h2>{t.batch.addConsumption}</h2>
      <div className="grid">
        <Lines title={t.records.lines} rows={rows} setRows={setRows} blank={blankStockLine}
          render={(r, set) => <StockLineFields line={r} set={set} kinds={kind === "roast" ? ["green_bean"] : INPUT_KINDS} onHand={onHand} issue warnGreen={kind !== "roast"} />} />
        <NoteField value={note} onChange={setNote} />
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="row row--end"><button className="btn btn--primary" disabled={busy}>{busy ? t.saving : t.batch.saveLater}</button></div>
    </form>
  );
}

// ---------- transfer ----------

function TransferForm() {
  const { t } = useOps();
  const { post, busy, error } = usePost();
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState(useHomeLocation());
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<StockLine[]>([blankStockLine()]);
  const onHand = useOnHand(from);
  return (
    <FormShell busy={busy} error={error} onSubmit={() => post(() => ({
      doc_type: "transfer", doc_date: date, location_code: from, note, data: { to },
      lines: rows.map((r) => linePayload(r)),
    }))}>
      <DateField value={date} onChange={setDate} />
      <LocationField label={t.f.from} value={from} onChange={setFrom} kinds={["own", "consignment"]} />
      <LocationField label={t.f.to} value={to} onChange={setTo} kinds={["own", "consignment"]} exclude={from} />
      <Lines title={t.records.lines} rows={rows} setRows={setRows} blank={blankStockLine}
        render={(r, set) => <StockLineFields line={r} set={set} onHand={onHand} issue />} />
      <NoteField value={note} onChange={setNote} />
    </FormShell>
  );
}

// ---------- stock adjustment (signed, with a reason) ----------

function AdjustmentForm() {
  const { t } = useOps();
  const { post, busy, error } = usePost();
  const [date, setDate] = useState(today);
  const [loc, setLoc] = useState(useHomeLocation());
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<StockLine[]>([blankStockLine()]);
  const onHand = useOnHand(loc);
  return (
    <FormShell busy={busy} error={error} onSubmit={() => post(() => ({
      doc_type: "adjustment", doc_date: date, location_code: loc, note, data: { reason: reason.trim() },
      lines: rows.map((r) => linePayload(r)),
    }))}>
      <DateField value={date} onChange={setDate} />
      <LocationField value={loc} onChange={setLoc} kinds={["own", "consignment"]} />
      <Field label={t.inv.reason} wide>{(id) => <input id={id} required value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      <Lines title={t.records.lines} rows={rows} setRows={setRows} blank={blankStockLine}
        render={(r, set) => <StockLineFields line={r} set={set} onHand={onHand} signed />} />
      <NoteField value={note} onChange={setNote} />
    </FormShell>
  );
}

// ---------- stock count ----------

function CountForm() {
  const { t, ref, lang } = useOps();
  const { post, busy, error } = usePost();
  const [date, setDate] = useState(today);
  const [loc, setLoc] = useState(useHomeLocation());
  const [category, setCategory] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const onHand = useOnHand(loc);
  const items = ref.items.filter((i) => i.active && inCategory(ref, i, category));
  const entered = Object.entries(counts).filter(([, v]) => v.trim() !== "");
  return (
    <FormShell busy={busy} error={error} onSubmit={() => post(() => ({
      doc_type: "count", doc_date: date, location_code: loc, note,
      lines: entered.map(([item, v]) => ({ item_id: item, qty: num(v) })),
    }))}>
      <DateField value={date} onChange={setDate} />
      <LocationField value={loc} onChange={(v) => { setLoc(v); setCounts({}); }} kinds={["own", "consignment"]} />
      <CategoryFilter value={category} onChange={setCategory} />
      <div className="field--wide scroll">
        <table className="table">
          <thead><tr><th>{t.f.item}</th><th className="n">{t.f.onHand.replace(" {n}", "")}</th><th className="n">{t.f.counted}</th></tr></thead>
          <tbody>
            {items.map((i: Item) => (
              <tr key={i.id} className={onHand(i.id) < 0 ? "neg" : undefined}>
                <td>{itemName(lang, i)}</td>
                <td className="n">{fq(onHand(i.id))} {unitLabel(t, i.base_unit)}</td>
                <td className="n">
                  <input type="number" inputMode="decimal" min="0" step="any" className="cell" aria-label={`${t.f.counted} ${itemName(lang, i)}`}
                    value={counts[i.id] ?? ""} onChange={(e) => setCounts({ ...counts, [i.id]: e.target.value })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NoteField value={note} onChange={setNote} />
    </FormShell>
  );
}

/** Category filter with "All", used by counts, stock and the item list. */
export function CategoryFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t, ref, lang } = useOps();
  const roots = ref.categories.filter((c) => c.active && !c.parent_code);
  const options = roots.flatMap((r) => [
    { value: r.code, label: lang === "th" ? r.name_th : r.name_en },
    ...ref.categories.filter((c) => c.active && c.parent_code === r.code).map((c) => ({ value: c.code, label: `— ${lang === "th" ? c.name_th : c.name_en}` })),
  ]);
  return <Field label={t.inv.category}>{(id) => <Select id={id} value={value} onChange={onChange} placeholder={t.inv.all} options={options} />}</Field>;
}

// ---------- ICONSIAM sales report import ----------
// Copies a store's monthly sales report line by line. The database re-checks every line and the
// report totals and refuses the import if anything disagrees; re-importing returns the same record.

type ImpLine = { item: string; code: string; desc: string; qty: string; price: string; gross: string; disc: string; net: string; supp: string };
const blankImp = (): ImpLine => ({ item: "", code: "", desc: "", qty: "", price: "", gross: "", disc: "0", net: "", supp: "" });

function ConsignmentForm() {
  const { t, ref, lang, go } = useOps();
  const consignLocs = useLocationOptions(["consignment"]);
  const consignChannels = ref.channels.filter((c) => c.kind === "consignment" && c.active);
  const [channel, setChannel] = useState(consignChannels[0]?.code ?? "");
  const [loc, setLoc] = useState(consignLocs[0]?.value ?? "");
  const ch = ref.channels.find((c) => c.code === channel);
  const [reportNo, setReportNo] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [ps, setPs] = useState("");
  const [pe, setPe] = useState("");
  const [generated, setGenerated] = useState("");
  const [gp, setGp] = useState(ch?.fee_percent != null ? String(Number(ch.fee_percent)) : "");
  const [file, setFile] = useState("");
  const [tot, setTot] = useState({ units: "", net: "", gp: "", supp: "", vat: "0" });
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<ImpLine[]>([blankImp()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null>(null);
  const [revision, setRevision] = useState(false);
  const [preview, setPreview] = useState<{ unchanged?: boolean; stock?: { item_id: string; diff: number; bucket: string }[] } | null>(null);
  const products = ref.items.filter((i) => i.kind === "product");

  const sum = (k: keyof ImpLine) => rows.reduce((s, r) => s + (num(r[k]) || 0), 0);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const matches = num(tot.units) === sum("qty") && round2(sum("net")) === num(tot.net) && round2(sum("supp")) === num(tot.supp)
    && round2(sum("net") - sum("supp")) === num(tot.gp);

  /** Fills the amounts a line implies, without overwriting what was typed. */
  const fill = (r: ImpLine): ImpLine => {
    const q = num(r.qty), p = num(r.price), d = num(r.disc) || 0, g = num(gp);
    const gross = r.gross || (q > 0 && p >= 0 ? String(round2(q * p)) : "");
    const net = r.net || (gross ? String(round2(num(gross) - d)) : "");
    const supp = r.supp || (net && g >= 0 ? String(round2(num(net) * (1 - g / 100))) : "");
    return { ...r, gross, net, supp };
  };

  const report = () => ({
    channel, location_code: loc, report_no: reportNo.trim(), branch_code: branchCode.trim(), branch_name: branchName.trim(),
    period_start: ps, period_end: pe, generated_at: generated || null, gp_percent: num(gp), note,
    method: "Entered in the app from the store's report",
    source: { file: file.trim() || null },
    totals: { units: num(tot.units), net_sales: num(tot.net), gp_amount: num(tot.gp), supplier_amount: num(tot.supp), vat_amount: num(tot.vat) },
    lines: rows.map((r) => ({ item_code: r.code.trim(), description: r.desc.trim(), qty: num(r.qty), unit_price: num(r.price),
      sales_amount: num(r.gross), discount: num(r.disc) || 0, net_sales: num(r.net), supplier_amount: num(r.supp) })),
  });
  // Official reports go through the sales layer: they replace interim figures for the same dates,
  // deduct only the stock difference, and a second report for a month must be saved as a revision.
  const payload = () => ({ kind: "final", channel, location_code: loc, report: report(), source: { type: "official_report", file: file.trim() || null },
    revision_of: revision && existing ? existing : null });
  const failed = (err: unknown) => {
    const e = err as { message?: string; details?: string };
    if (/final_exists/.test(e?.message ?? "")) {
      try { setExisting(JSON.parse(e.details ?? "{}").update ?? null); } catch { /* no detail */ }
    }
    setError(errorText(t, err));
  };
  const runPreview = async () => {
    setBusy(true); setError(null); setPreview(null);
    const { data, error: err } = await db.rpc("preview_sales_update", { p: payload() });
    setBusy(false);
    if (err) { failed(err); return; }
    const pv = data as { ready: boolean; error?: string; error_detail?: string; unchanged?: boolean; stock?: { item_id: string; diff: number; bucket: string }[] };
    if (pv.error) failed({ message: pv.error, details: pv.error_detail }); else setPreview(pv);
  };
  const submit = async () => {
    setBusy(true); setError(null);
    const { data, error: err } = await db.rpc("commit_sales_update", { p: payload() });
    setBusy(false);
    if (err) failed(err);
    else {
      const docId = (data as { update: { doc_id: string | null } }).update.doc_id;
      go(docId ? `/record/${docId}/new` : "/iconsiam?tab=sales");
    }
  };

  return (
    <FormShell busy={busy} error={error} onSubmit={submit}
      footer={<>
        <p className="total">{fmt(t.imp.check, { status: matches ? t.imp.ok : t.imp.notOk })} · {t.f.total}: {fq(sum("qty"))} · {fmt(t.baht, { n: money(sum("net")) })} · {fmt(t.baht, { n: money(sum("supp")) })}</p>
        {existing && <label className="check"><input type="checkbox" checked={revision} onChange={(e) => { setRevision(e.target.checked); setPreview(null); }} /> {t.ics.revisionTick}</label>}
        <div className="row"><button type="button" className="btn" disabled={busy} onClick={runPreview}>{t.ics.previewFinal}</button><span className="small muted">{t.ics.notSavedYet}</span></div>
        {preview && (
          <div className="notice notice--info">
            <strong>{t.ics.previewTitle}</strong>
            {preview.unchanged ? <p>{t.ics.unchanged}</p> : (
              <ul className="plain">
                {(preview.stock ?? []).filter((x) => Number(x.diff) !== 0).map((x) => (
                  <li key={x.item_id}>{itemName(lang, ref.items.find((i) => i.id === x.item_id))}: {Number(x.diff) > 0 ? "−" : "+"}{fq(Math.abs(Number(x.diff)))} · {t.ics.bucket[x.bucket as keyof typeof t.ics.bucket] ?? x.bucket}</li>
                ))}
                {!(preview.stock ?? []).some((x) => Number(x.diff) !== 0) && <li>{t.ics.noChange}</li>}
              </ul>
            )}
          </div>
        )}
      </>}>
      <p className="field--wide muted">{t.imp.intro}</p>
      <Field label={t.f.channel}>{(id) => <Select id={id} value={channel} onChange={setChannel} options={consignChannels.map((c) => ({ value: c.code, label: c.name }))} />}</Field>
      <Field label={t.f.location}>{(id) => <Select id={id} value={loc} onChange={setLoc} options={consignLocs} />}</Field>
      <Field label={t.f.reportNo}>{(id) => <input id={id} value={reportNo} onChange={(e) => setReportNo(e.target.value)} />}</Field>
      <Field label={t.imp.branchCode}>{(id) => <input id={id} value={branchCode} onChange={(e) => setBranchCode(e.target.value)} />}</Field>
      <Field label={t.imp.branchName}>{(id) => <input id={id} value={branchName} onChange={(e) => setBranchName(e.target.value)} />}</Field>
      <Field label={t.imp.periodStart}>{(id) => <input id={id} type="date" value={ps} onChange={(e) => setPs(e.target.value)} />}</Field>
      <Field label={t.imp.periodEnd}>{(id) => <input id={id} type="date" value={pe} min={ps} onChange={(e) => setPe(e.target.value)} />}</Field>
      <Field label={`${t.imp.generated} ${t.optional}`}>{(id) => <input id={id} type="date" value={generated} onChange={(e) => setGenerated(e.target.value)} />}</Field>
      <Field label={t.f.gp}>{(id) => <NumberInput id={id} value={gp} onChange={setGp} />}</Field>
      <Field label={`${t.imp.file} ${t.optional}`}>{(id) => <input id={id} value={file} onChange={(e) => setFile(e.target.value)} />}</Field>
      <Lines title={t.records.lines} rows={rows} setRows={setRows} blank={blankImp}
        render={(r, set) => (
          <>
            <Field label={t.imp.pick}>{(id) => <Select id={id} value={r.item} placeholder="—"
              options={products.filter((p) => p.iconsiam_code).map((p) => ({ value: p.id, label: `${itemName(lang, p)} · ${p.iconsiam_code}` }))}
              onChange={(v) => { const p = products.find((x) => x.id === v); set({ item: v, code: p?.iconsiam_code ?? r.code }); }} />}</Field>
            <Field label={t.imp.itemCode}>{(id) => <input id={id} value={r.code} inputMode="numeric" onChange={(e) => set({ code: e.target.value, item: "" })} />}</Field>
            <Field label={t.imp.description}>{(id) => <input id={id} value={r.desc} onChange={(e) => set({ desc: e.target.value })} />}</Field>
            <Field label={t.f.qty}>{(id) => <NumberInput id={id} value={r.qty} step="1" onChange={(v) => set({ qty: v })} />}</Field>
            <Field label={t.f.unitPrice}>{(id) => <NumberInput id={id} value={r.price} onChange={(v) => set({ price: v })} />}</Field>
            <Field label={t.imp.salesAmount}>{(id) => <NumberInput id={id} value={r.gross} onChange={(v) => set({ gross: v })} />}</Field>
            <Field label={t.f.discount}>{(id) => <NumberInput id={id} value={r.disc} onChange={(v) => set({ disc: v })} />}</Field>
            <Field label={t.imp.netSales}>{(id) => <NumberInput id={id} value={r.net} onChange={(v) => set({ net: v })} />}</Field>
            <Field label={t.imp.supplierAmount}>{(id) => <NumberInput id={id} value={r.supp} onChange={(v) => set({ supp: v })} />}</Field>
            <div className="field"><button type="button" className="btn btn--small" onClick={() => set(fill(r))}>{t.imp.fill}</button></div>
          </>
        )} />
      <fieldset className="lines field--wide">
        <legend>{t.imp.totals}</legend>
        <div className="grid">
          <Field label={t.imp.totalUnits}>{(id) => <NumberInput id={id} value={tot.units} onChange={(v) => setTot({ ...tot, units: v })} />}</Field>
          <Field label={t.imp.totalNet}>{(id) => <NumberInput id={id} value={tot.net} onChange={(v) => setTot({ ...tot, net: v })} />}</Field>
          <Field label={t.imp.totalGp}>{(id) => <NumberInput id={id} value={tot.gp} onChange={(v) => setTot({ ...tot, gp: v })} />}</Field>
          <Field label={t.imp.totalSupplier}>{(id) => <NumberInput id={id} value={tot.supp} onChange={(v) => setTot({ ...tot, supp: v })} />}</Field>
          <Field label={t.imp.vat}>{(id) => <NumberInput id={id} value={tot.vat} onChange={(v) => setTot({ ...tot, vat: v })} />}</Field>
        </div>
      </fieldset>
      <NoteField value={note} onChange={setNote} />
    </FormShell>
  );
}

// ---------- settle a balance (money received / bill paid) ----------

function PaymentForm() {
  const { t, ref } = useOps();
  const names = useNames();
  const { post, busy, error } = usePost();
  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [forDoc, setForDoc] = useState("");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState("");
  const [close, setClose] = useState(false);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<OpenRecord[]>([]);
  const paidOpts = usePaidOptions(true, false);
  useEffect(() => {
    setForDoc(""); setAmount("");
    const q = direction === "in"
      ? db.from("receivables").select("*").gt("open_amount", 0).order("doc_date")
      : db.from("payables").select("*").order("doc_date");
    q.then(({ data }) => setOpen(((data ?? []) as OpenRecord[]).filter((r) => direction === "in" || Number(r.total) - Number(r.paid) > 0)));
  }, [direction]);
  const remaining = (r: OpenRecord) => (direction === "in" ? Number(r.open_amount) : Number(r.total) - Number(r.paid));
  const label = (r: OpenRecord) => `${r.doc_no} · ${r.doc_date} · ${direction === "in" ? names.channel(r.channel) : r.supplier ?? t.categories[r.doc_type as keyof typeof t.categories] ?? ""} · ${fmt(t.baht, { n: money(remaining(r)) })}`;
  const accountOpts = direction === "in" ? ref.accounts.filter((a) => a.active).map((a) => ({ value: a.code, label: a.name })) : paidOpts;
  return (
    <FormShell busy={busy} error={error} onSubmit={() => post(() => ({
      doc_type: "payment", doc_date: date, total: num(amount), note,
      data: direction === "in" ? { direction, for_doc: forDoc, account, close } : { direction, for_doc: forDoc, paid: account },
    }))}>
      <DateField value={date} onChange={setDate} />
      <Field label={t.f.direction}>{(id) => <Select id={id} value={direction} onChange={(v) => setDirection(v as "in" | "out")}
        options={[{ value: "in", label: t.f.dirIn }, { value: "out", label: t.f.dirOut }]} />}</Field>
      <Field label={t.f.forDoc} wide>{(id) => <Select id={id} value={forDoc} placeholder="—" options={open.map((r) => ({ value: r.id, label: label(r) }))}
        onChange={(v) => { setForDoc(v); const r = open.find((x) => x.id === v); if (r) setAmount(String(remaining(r))); }} />}</Field>
      <Field label={t.f.amount}>{(id) => <NumberInput id={id} value={amount} onChange={setAmount} />}</Field>
      <Field label={direction === "in" ? t.f.account : t.f.paidBy}>{(id) => <Select id={id} value={account} onChange={setAccount} placeholder="—" options={accountOpts} />}</Field>
      {direction === "in" && (
        <label className="check field--wide"><input type="checkbox" checked={close} onChange={(e) => setClose(e.target.checked)} /> {t.f.close}</label>
      )}
      <NoteField value={note} onChange={setNote} />
    </FormShell>
  );
}

// ---------- partner money ----------

function PartnerForm() {
  const { t, ref } = useOps();
  const { post, busy, error } = usePost();
  const [date, setDate] = useState(today);
  const [kind, setKind] = useState("contribution");
  const [member, setMember] = useState("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <FormShell busy={busy} error={error} onSubmit={() => post(() => ({
      doc_type: "partner", doc_date: date, total: num(amount), note, data: { kind, member, account },
    }))}>
      <DateField value={date} onChange={setDate} />
      <Field label={t.f.kind}>{(id) => <Select id={id} value={kind} onChange={setKind}
        options={(["contribution", "drawing", "reimbursed"] as const).map((k) => ({ value: k, label: t.partnerKinds[k] }))} />}</Field>
      <Field label={t.f.member}>{(id) => <Select id={id} value={member} onChange={setMember} placeholder="—"
        options={ref.members.filter((m) => m.role !== "staff").map((m) => ({ value: m.id, label: m.display_name }))} />}</Field>
      <Field label={t.f.account}>{(id) => <Select id={id} value={account} onChange={setAccount} placeholder="—"
        options={ref.accounts.filter((a) => a.active).map((a) => ({ value: a.code, label: a.name }))} />}</Field>
      <Field label={t.f.amount}>{(id) => <NumberInput id={id} value={amount} onChange={setAmount} />}</Field>
      <NoteField value={note} onChange={setNote} />
    </FormShell>
  );
}

// ---------- opening balance ----------

type OpenLine = { kind: "stock" | "money" | "partner"; item: string; location: string; qty: string; cost: string; account: string; member: string; partnerKind: string; amount: string };
const blankOpen = (): OpenLine => ({ kind: "stock", item: "", location: "CK", qty: "", cost: "", account: "", member: "", partnerKind: "contribution", amount: "" });

function OpeningForm() {
  const { t, ref } = useOps();
  const { post, busy, error } = usePost();
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<OpenLine[]>([blankOpen()]);
  const items = useItemOptions();
  const locs = useLocationOptions(["own", "consignment"]);
  const showMoney = seesMoney(ref.me.role);
  const lines = useMemo(() => rows.map((r) =>
    r.kind === "stock" ? { kind: "stock", item_id: r.item || null, qty: num(r.qty), location: r.location, ...(r.cost ? { unit_price: num(r.cost) } : {}) }
      : r.kind === "money" ? { kind: "money", account: r.account, amount: num(r.amount) }
        : { kind: "partner", member: r.member, partner_kind: r.partnerKind, amount: num(r.amount) }), [rows]);
  return (
    <FormShell busy={busy} error={error} onSubmit={() => post(() => ({ doc_type: "opening", doc_date: date, note, lines }))}>
      <DateField value={date} onChange={setDate} />
      <Lines title={t.records.lines} rows={rows} setRows={setRows} blank={blankOpen}
        render={(r, set) => (
          <>
            <Field label={t.f.lineKind}>{(id) => <Select id={id} value={r.kind} onChange={(v) => set({ kind: v as OpenLine["kind"] })}
              options={[{ value: "stock", label: t.f.stockLine }, ...(showMoney ? [{ value: "money", label: t.f.moneyLine }, { value: "partner", label: t.f.partnerLine }] : [])]} />}</Field>
            {r.kind === "stock" && (
              <>
                <Field label={t.f.item}>{(id) => <Select id={id} value={r.item} onChange={(v) => set({ item: v })} placeholder="—" options={items} />}</Field>
                <Field label={t.f.location}>{(id) => <Select id={id} value={r.location} onChange={(v) => set({ location: v })} options={locs} />}</Field>
                <Field label={t.f.qty}>{(id) => <NumberInput id={id} value={r.qty} onChange={(v) => set({ qty: v })} />}</Field>
                <Field label={`${t.f.unitCost} ${t.optional}`}>{(id) => <NumberInput id={id} value={r.cost} onChange={(v) => set({ cost: v })} />}</Field>
              </>
            )}
            {r.kind === "money" && (
              <>
                <Field label={t.f.account}>{(id) => <Select id={id} value={r.account} onChange={(v) => set({ account: v })} placeholder="—"
                  options={ref.accounts.map((a) => ({ value: a.code, label: a.name }))} />}</Field>
                <Field label={t.f.amount}>{(id) => <NumberInput id={id} value={r.amount} min="-1000000000" onChange={(v) => set({ amount: v })} />}</Field>
              </>
            )}
            {r.kind === "partner" && (
              <>
                <Field label={t.f.member}>{(id) => <Select id={id} value={r.member} onChange={(v) => set({ member: v })} placeholder="—"
                  options={ref.members.filter((m) => m.role !== "staff").map((m) => ({ value: m.id, label: m.display_name }))} />}</Field>
                <Field label={t.f.kind}>{(id) => <Select id={id} value={r.partnerKind} onChange={(v) => set({ partnerKind: v })}
                  options={[{ value: "contribution", label: t.partnerKinds.contribution }, { value: "paid_for_business", label: t.f.owedToPartner }]} />}</Field>
                <Field label={t.f.amount}>{(id) => <NumberInput id={id} value={r.amount} onChange={(v) => set({ amount: v })} />}</Field>
              </>
            )}
          </>
        )} />
      <NoteField value={note} onChange={setNote} />
    </FormShell>
  );
}
