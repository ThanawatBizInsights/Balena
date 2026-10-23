// Shared pieces for the operations app: context, form fields, labels.
import { createContext, useContext, useId, type ReactNode } from "react";
import type { Lang } from "../i18n/lang";
import type { OpsText } from "../i18n/ops";
import { fmt, inCategory, qty as qtyFmt, unitsFor, type Item, type Ref, type Status } from "./api";

export interface Ctx { t: OpsText; lang: Lang; ref: Ref; reloadRef: () => Promise<void>; go: (hash: string) => void }
export const OpsCtx = createContext<Ctx | null>(null);
export function useOps() {
  const c = useContext(OpsCtx);
  if (!c) throw new Error("useOps outside OpsCtx");
  return c;
}

export const itemName = (lang: Lang, i: Pick<Item, "name_th" | "name_en"> | undefined) => (i ? (lang === "th" ? i.name_th : i.name_en) : "?");

export function useNames() {
  const { ref, lang } = useOps();
  return {
    item: (id: string | null | undefined) => itemName(lang, ref.items.find((i) => i.id === id)),
    loc: (code: string | null | undefined) => {
      const l = ref.locations.find((x) => x.code === code);
      return l ? (lang === "th" ? l.name_th : l.name_en) : code ?? "–";
    },
    member: (id: string | null | undefined) => ref.members.find((m) => m.id === id)?.display_name ?? "–",
    channel: (code: unknown) => ref.channels.find((c) => c.code === code)?.name ?? String(code ?? "–"),
    account: (code: unknown) => ref.accounts.find((a) => a.code === code)?.name ?? String(code ?? "–"),
    category: (code: string | null | undefined) => {
      const c = ref.categories.find((x) => x.code === code);
      return c ? (lang === "th" ? c.name_th : c.name_en) : code ?? "–";
    },
  };
}

export function Field({ label, hint, error, children, wide }: { label: string; hint?: string; error?: string; children: (id: string, describedBy?: string) => ReactNode; wide?: boolean }) {
  const id = useId();
  const hintId = hint || error ? `${id}-hint` : undefined;
  return (
    <div className={wide ? "field field--wide" : "field"}>
      <label htmlFor={id}>{label}</label>
      {children(id, hintId)}
      {(hint || error) && <p id={hintId} className={error ? "field__error" : "field__hint"}>{error ?? hint}</p>}
    </div>
  );
}

export function Select({ id, value, onChange, options, placeholder, describedBy, required }: {
  id: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
  placeholder?: string; describedBy?: string; required?: boolean;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} required={required}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function NumberInput({ id, value, onChange, step = "any", min = "0", describedBy, placeholder }: {
  id: string; value: string; onChange: (v: string) => void; step?: string; min?: string; describedBy?: string; placeholder?: string;
}) {
  return (
    <input id={id} type="number" inputMode="decimal" step={step} min={min} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} />
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useOps();
  return <span className={`badge badge--${status}`}>{t.status[status]}</span>;
}

export function Notice({ kind, children }: { kind: "ok" | "error" | "info"; children: ReactNode }) {
  return <p className={`notice notice--${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</p>;
}

/** Items of the given kinds, active only, as select options. */
export function useItemOptions(kinds?: Item["kind"][]) {
  const { ref, lang } = useOps();
  return ref.items
    .filter((i) => i.active && (!kinds || kinds.includes(i.kind)))
    .map((i) => ({ value: i.id, label: itemName(lang, i) }));
}

// ---------- Category → Item → Quantity → Unit ----------

export interface StockLine { category: string; item: string; qty: string; unit: string }
export const blankStockLine = (): StockLine => ({ category: "", item: "", qty: "", unit: "" });

/** The line's quantity in the item's base unit (NaN when incomplete). */
export function baseQty(ref: Ref, line: StockLine): number {
  const item = ref.items.find((i) => i.id === line.item);
  const q = line.qty.trim() === "" ? NaN : Number(line.qty);
  const f = unitsFor(ref, item).find((u) => u.unit === (line.unit || item?.base_unit))?.factor ?? NaN;
  return q * f;
}

/** Payload for the server, which converts units itself: {item_id, qty, unit}. */
export const linePayload = (line: StockLine, extra: Record<string, unknown> = {}) =>
  ({ item_id: line.item || null, qty: line.qty.trim() === "" ? null : Number(line.qty), unit: line.unit || undefined, ...extra });

export function unitLabel(t: OpsText, unit: string) {
  return (t.units as Record<string, string>)[unit] ?? unit;
}

export function StockLineFields({ line, set, kinds, onHand, issue, signed, warnGreen }: {
  line: StockLine; set: (patch: Partial<StockLine>) => void; kinds?: Item["kind"][];
  /** On-hand quantity at the location in base units, when known. */
  onHand?: (itemId: string) => number;
  /** True when the line takes stock out (sale, use, transfer): shows the negative-stock warning. */
  issue?: boolean;
  signed?: boolean;
  warnGreen?: boolean;
}) {
  const { t, ref, lang } = useOps();
  const cats = ref.categories.filter((c) => c.active && (!kinds || kinds.includes(c.kind)));
  const roots = cats.filter((c) => !c.parent_code || !cats.some((p) => p.code === c.parent_code));
  const catOptions = roots.flatMap((r) => [
    { value: r.code, label: lang === "th" ? r.name_th : r.name_en },
    ...cats.filter((c) => c.parent_code === r.code).map((c) => ({ value: c.code, label: `— ${lang === "th" ? c.name_th : c.name_en}` })),
  ]);
  const items = ref.items.filter((i) => i.active && (!kinds || kinds.includes(i.kind)) && inCategory(ref, i, line.category));
  const item = ref.items.find((i) => i.id === line.item);
  const units = unitsFor(ref, item);
  const unit = line.unit || item?.base_unit || "";
  const q = baseQty(ref, line);
  const have = item && onHand ? onHand(item.id) : undefined;
  const after = have !== undefined && Number.isFinite(q) ? have + (issue ? -q : q) : undefined;
  const hints: string[] = [];
  if (item && Number.isFinite(q) && unit !== item.base_unit) hints.push(fmt(t.inv.converted, { n: qtyFmt(q), unit: unitLabel(t, item.base_unit) }));
  if (item && have !== undefined) hints.push(fmt(t.f.onHand, { n: `${qtyFmt(have)} ${unitLabel(t, item.base_unit)}` }));
  const negative = after !== undefined && after < 0;
  return (
    <>
      <Field label={t.inv.category}>{(id) => (
        <Select id={id} value={line.category} placeholder={t.inv.all} options={catOptions}
          onChange={(v) => set({ category: v, ...(item && !inCategory(ref, item, v) ? { item: "", unit: "" } : {}) })} />
      )}</Field>
      <Field label={t.f.item}>{(id) => (
        <Select id={id} value={line.item} placeholder="—" options={items.map((i) => ({ value: i.id, label: itemName(lang, i) }))}
          onChange={(v) => set({ item: v, unit: ref.items.find((i) => i.id === v)?.base_unit ?? "" })} />
      )}</Field>
      <Field label={t.f.qty} hint={signed ? t.inv.signedHint : hints.join(" · ") || undefined}>{(id, d) => (
        <NumberInput id={id} value={line.qty} onChange={(v) => set({ qty: v })} min={signed ? "-1000000000" : "0"} describedBy={d} />
      )}</Field>
      <Field label={t.f.unit}>{(id) => (
        <Select id={id} value={unit} onChange={(v) => set({ unit: v })}
          options={(units.length ? units : [{ unit: "", factor: 1, builtIn: true }]).map((u) => ({
            value: u.unit, label: u.builtIn ? unitLabel(t, u.unit) : `${u.unit} (${qtyFmt(u.factor)} ${unitLabel(t, item?.base_unit ?? "")})`,
          }))} />
      )}</Field>
      {issue && negative && (
        <p className="field--wide warn" role="status">
          <span aria-hidden="true">⚠</span> {t.inv.negWarn} {fmt(t.inv.after, { n: `${qtyFmt(after!)} ${unitLabel(t, item!.base_unit)}` })}
        </p>
      )}
      {warnGreen && item?.kind === "green_bean" && (
        <p className="field--wide warn" role="status"><span aria-hidden="true">⚠</span> {t.inv.greenWarn}</p>
      )}
    </>
  );
}
