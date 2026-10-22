// Shared pieces for the operations app: context, form fields, labels.
import { createContext, useContext, useId, type ReactNode } from "react";
import type { Lang } from "../i18n/lang";
import type { OpsText } from "../i18n/ops";
import type { Item, Ref, Status } from "./api";

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
