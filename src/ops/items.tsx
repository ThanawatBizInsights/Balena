// Items & Categories. Every active member can add items and make normal edits (names, pack size,
// reorder level, barcode). The owner (trusted login, ref.isOwner from my_access) also moves items
// between compatible categories, sets units and codes, archives, deletes unused items and manages
// categories. The database enforces the same rules; this page only shows the right controls.
import { useMemo, useState, type FormEvent } from "react";
import { db, errorText, fmt, inCategory, qty as fq, type Category, type Item, type ItemKind } from "./api";
import { CategoryFilter } from "./forms";
import { Field, Notice, NumberInput, Select, itemName, unitLabel, useNames, useOps } from "./ui";

type Msg = { kind: "ok" | "error"; text: string } | null;

export function ItemsPage() {
  const { t, ref, lang } = useOps();
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "all">("active");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const names = useNames();
  const q = search.trim().toLowerCase();
  const items = ref.items.filter((i) => inCategory(ref, i, category)
    && (status === "all" || (status === "active") === i.active)
    && (!q || i.code.toLowerCase().includes(q) || i.name_th.toLowerCase().includes(q) || i.name_en.toLowerCase().includes(q)));

  return (
    <section>
      <h1>{t.nav.items}</h1>
      <div className="filters">
        <CategoryFilter value={category} onChange={setCategory} />
        <Field label={t.itm.search}>{(id) => <input id={id} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}</Field>
        <Field label={t.itm.status}>{(id) => <Select id={id} value={status} onChange={(v) => setStatus(v as typeof status)}
          options={[{ value: "active", label: t.itm.active }, { value: "archived", label: t.itm.archived }, { value: "all", label: t.inv.all }]} />}</Field>
      </div>
      <div className="row row--between">
        <p className="muted">{fmt(t.itm.count, { n: items.length })}</p>
        <button type="button" className="btn btn--primary" onClick={() => { setEditing("new"); setMsg(null); }}>{t.itm.add}</button>
      </div>
      {!ref.isOwner && <p className="muted small">{t.itm.ownerNote}</p>}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {editing && (
        <ItemEditor key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} defaultCategory={category}
          onDone={(m) => { setEditing(null); setMsg(m); }} />
      )}
      <ul className="item-list">
        {items.map((i) => (
          <li key={i.id} className={i.active ? undefined : "is-archived"}>
            <div className="item-list__main">
              <strong>{itemName(lang, i)}</strong>
              <span className="muted small"><span className="mono">{i.code}</span> · {names.category(i.category_code)} · {unitLabel(t, i.base_unit)}
                {!i.active && <> · {t.itm.archived}</>}</span>
            </div>
            <button type="button" className="btn btn--small" onClick={() => { setEditing(i); setMsg(null); }}>{t.itm.edit}</button>
          </li>
        ))}
      </ul>
      {ref.isOwner && <Categories />}
    </section>
  );
}

type Form = {
  code: string; name_th: string; name_en: string; category_code: string; base_unit: string;
  size_value: string; size_unit: string; pack: string; pack_note: string; barcode: string; min_level: string;
  units: { unit: string; factor: string }[];
};

function ItemEditor({ item, defaultCategory, onDone }: { item: Item | null; defaultCategory: string; onDone: (m: Msg) => void }) {
  const { t, ref, lang, reloadRef } = useOps();
  const owner = ref.isOwner;
  const isNew = !item;
  const [f, setF] = useState<Form>(() => ({
    code: item?.code ?? "", name_th: item?.name_th ?? "", name_en: item?.name_en ?? "",
    category_code: item?.category_code ?? defaultCategory, base_unit: item?.base_unit ?? "pc",
    size_value: item?.size_value != null ? String(Number(item.size_value)) : "", size_unit: item?.size_unit ?? "g", pack: item?.pack ?? "",
    pack_note: item?.pack_note ?? "", barcode: item?.barcode ?? "", min_level: item?.min_level != null ? String(Number(item.min_level)) : "",
    units: ref.conversions.filter((c) => c.item_id === item?.id).map((c) => ({ unit: c.unit, factor: String(Number(c.factor)) })),
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cat = ref.categories.find((c) => c.code === f.category_code);
  const kind = item?.kind ?? cat?.kind;
  const isProduct = kind === "product";
  // New items: any active category. Existing items: only categories holding the same kind of stock.
  const catOptions = ref.categories.filter((c) => c.active && (isNew || c.kind === item!.kind))
    .map((c) => ({ value: c.code, label: `${c.parent_code ? "— " : ""}${lang === "th" ? c.name_th : c.name_en}` }));
  const canSetUnits = owner || isNew;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const p: Record<string, unknown> = {
      name_th: f.name_th, name_en: f.name_en, pack_note: f.pack_note, barcode: f.barcode, min_level: f.min_level,
      ...(isProduct ? { size_value: f.size_value, size_unit: f.size_value ? f.size_unit : "", pack: f.pack } : {}),
    };
    if (isNew) Object.assign(p, { code: f.code, category_code: f.category_code, base_unit: isProduct ? "pc" : f.base_unit,
      units: f.units.filter((u) => u.unit.trim()).map((u) => ({ unit: u.unit.trim(), factor: Number(u.factor) })) });
    else {
      Object.assign(p, { id: item!.id, version: item!.version });
      if (owner) Object.assign(p, { code: f.code, category_code: f.category_code, base_unit: f.base_unit,
        units: f.units.filter((u) => u.unit.trim()).map((u) => ({ unit: u.unit.trim(), factor: Number(u.factor) })) });
    }
    const { error } = await db.rpc("save_item", { p });
    setBusy(false);
    if (error) { setErr(errorText(t, error)); return; }
    await reloadRef();
    onDone({ kind: "ok", text: t.itm.saved });
  };

  const archive = async (archived: boolean) => {
    const { error } = await db.rpc("archive_item", { p_id: item!.id, p_archived: archived });
    if (error) { setErr(errorText(t, error)); return; }
    await reloadRef();
    onDone({ kind: "ok", text: t.itm.saved });
  };

  const remove = async () => {
    if (!window.confirm(fmt(t.itm.removeConfirm, { name: itemName(lang, item!) }))) return;
    // Owner-only row rule: removes nothing unless the item has never been used.
    await db.from("unit_conversions").delete().eq("item_id", item!.id);
    const { data, error } = await db.from("stock_items").delete().eq("id", item!.id).select("id");
    if (error || !data?.length) { setErr(error ? errorText(t, error) : t.itm.removeRefused); return; }
    await reloadRef();
    onDone({ kind: "ok", text: t.itm.removed });
  };

  return (
    <form className="card form" onSubmit={save} noValidate>
      <h2>{isNew ? t.itm.newItem : itemName(lang, item!)}</h2>
      <div className="grid">
        <Field label={t.itm.code} hint={!isNew && !owner ? t.itm.ownerNote : undefined}>{(id, d) => (
          <input id={id} value={f.code} disabled={!isNew && !owner} aria-describedby={d} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
        )}</Field>
        <Field label={t.itm.nameTh}>{(id) => <input id={id} value={f.name_th} onChange={(e) => setF({ ...f, name_th: e.target.value })} />}</Field>
        <Field label={t.itm.nameEn}>{(id) => <input id={id} value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} />}</Field>
        <Field label={t.inv.category}>{(id) => (
          <select id={id} value={f.category_code} disabled={!isNew && !owner} onChange={(e) => setF({ ...f, category_code: e.target.value })}>
            {isNew && <option value="">—</option>}
            {catOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}</Field>
        {!isProduct && (
          <Field label={t.itm.baseUnit} hint={!isNew ? t.itm.unitLocked : undefined}>{(id, d) => (
            <select id={id} value={f.base_unit} disabled={!isNew && !owner} aria-describedby={d} onChange={(e) => setF({ ...f, base_unit: e.target.value })}>
              {(["g", "mL", "pc"] as const).map((u) => <option key={u} value={u}>{unitLabel(t, u)}</option>)}
            </select>
          )}</Field>
        )}
        {isProduct && (
          <>
            <Field label={`${t.itm.size} ${t.optional}`}>{(id) => <NumberInput id={id} value={f.size_value} onChange={(v) => setF({ ...f, size_value: v })} />}</Field>
            <Field label={t.f.unit}>{(id) => <Select id={id} value={f.size_unit} onChange={(v) => setF({ ...f, size_unit: v })}
              options={[{ value: "g", label: unitLabel(t, "g") }, { value: "mL", label: unitLabel(t, "mL") }]} />}</Field>
          </>
        )}
        <Field label={`${t.itm.packNote} ${t.optional}`}>{(id) => <input id={id} value={f.pack_note} onChange={(e) => setF({ ...f, pack_note: e.target.value })} />}</Field>
        <Field label={`${t.itm.reorder} ${t.optional}`}>{(id) => <NumberInput id={id} value={f.min_level} onChange={(v) => setF({ ...f, min_level: v })} />}</Field>
        <Field label={`${t.itm.barcode} ${t.optional}`}>{(id) => <input id={id} value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} />}</Field>
        {!isProduct && (
          <fieldset className="lines field--wide" disabled={!canSetUnits}>
            <legend>{t.itm.entryUnits}</legend>
            <p className="muted small">{t.itm.entryUnitsHint}</p>
            {f.units.map((u, i) => (
              <div className="line" key={i}>
                <Field label={t.itm.unitName}>{(id) => <input id={id} value={u.unit} onChange={(e) => setF({ ...f, units: f.units.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)) })} />}</Field>
                <Field label={fmt(t.itm.factor, { unit: unitLabel(t, f.base_unit) })}>{(id) => (
                  <NumberInput id={id} value={u.factor} onChange={(v) => setF({ ...f, units: f.units.map((x, j) => (j === i ? { ...x, factor: v } : x)) })} />
                )}</Field>
                <button type="button" className="link line__remove" onClick={() => setF({ ...f, units: f.units.filter((_, j) => j !== i) })}>{t.remove}</button>
              </div>
            ))}
            <button type="button" className="btn btn--small" onClick={() => setF({ ...f, units: [...f.units, { unit: "", factor: "" }] })}>{t.itm.addUnit}</button>
          </fieldset>
        )}
      </div>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="row row--between">
        <div className="row">
          {!isNew && owner && (item!.active
            ? <button type="button" className="btn" onClick={() => archive(true)}>{t.itm.archive}</button>
            : <button type="button" className="btn" onClick={() => archive(false)}>{t.itm.restore}</button>)}
          {!isNew && owner && <button type="button" className="btn btn--danger" onClick={remove}>{t.itm.remove}</button>}
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => onDone(null)}>{t.cancel}</button>
          <button className="btn btn--primary" disabled={busy}>{busy ? t.saving : t.save}</button>
        </div>
      </div>
    </form>
  );
}

const KINDS: ItemKind[] = ["green_bean", "ingredient", "roasted_bean", "product", "packaging", "consumable"];

/** Owner only: add, rename and delete (empty, non-system) categories. */
function Categories() {
  const { t, ref, lang, reloadRef } = useOps();
  const [msg, setMsg] = useState<Msg>(null);
  const [n, setN] = useState({ code: "", name_th: "", name_en: "", parent_code: "", kind: "packaging" as ItemKind });
  const counts = useMemo(() => Object.fromEntries(ref.categories.map((c) => [c.code, ref.items.filter((i) => i.category_code === c.code).length])), [ref]);
  const roots = ref.categories.filter((c) => !c.parent_code);
  const ordered: Category[] = roots.flatMap((r) => [r, ...ref.categories.filter((c) => c.parent_code === r.code)]);

  const run = async (fn: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setMsg(null);
    const { error } = await fn();
    if (error) setMsg({ kind: "error", text: errorText(t, error) });
    else { setMsg({ kind: "ok", text: ok }); await reloadRef(); }
  };
  const rename = (c: Category, name_th: string, name_en: string) =>
    run(() => db.rpc("save_category", { p: { code: c.code, name_th, name_en } }), t.itm.saved);
  const remove = async (c: Category) => {
    setMsg(null);
    const { data, error } = await db.from("item_categories").delete().eq("code", c.code).select("code");
    if (error || !data?.length) setMsg({ kind: "error", text: error ? errorText(t, error) : t.itm.catRefused });
    else { setMsg({ kind: "ok", text: t.itm.catDeleted }); await reloadRef(); }
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    run(() => db.rpc("save_category", { p: { ...n, code: n.code.toUpperCase() } }), t.itm.saved)
      .then(() => setN({ ...n, code: "", name_th: "", name_en: "" }));
  };

  return (
    <div className="card">
      <h2>{t.itm.categories}</h2>
      <ul className="cat-list">
        {ordered.map((c) => (
          <CategoryRow key={c.code} c={c} count={counts[c.code] ?? 0} lang={lang} onRename={rename} onRemove={remove} />
        ))}
      </ul>
      <h3>{t.itm.addCategory}</h3>
      <form className="grid" onSubmit={add}>
        <Field label={t.itm.code}>{(id) => <input id={id} required value={n.code} onChange={(e) => setN({ ...n, code: e.target.value.toUpperCase() })} />}</Field>
        <Field label={t.itm.nameTh}>{(id) => <input id={id} required value={n.name_th} onChange={(e) => setN({ ...n, name_th: e.target.value })} />}</Field>
        <Field label={t.itm.nameEn}>{(id) => <input id={id} required value={n.name_en} onChange={(e) => setN({ ...n, name_en: e.target.value })} />}</Field>
        <Field label={t.itm.parent}>{(id) => <Select id={id} value={n.parent_code} placeholder={t.itm.topLevel}
          onChange={(v) => setN({ ...n, parent_code: v, kind: ref.categories.find((c) => c.code === v)?.kind ?? n.kind })}
          options={roots.map((r) => ({ value: r.code, label: lang === "th" ? r.name_th : r.name_en }))} />}</Field>
        <Field label={t.itm.stockKind}>{(id) => <Select id={id} value={n.kind} onChange={(v) => setN({ ...n, kind: v as ItemKind })}
          options={KINDS.map((k) => ({ value: k, label: t.kinds[k] }))} />}</Field>
        <div className="field"><button className="btn btn--primary">{t.itm.addCategory}</button></div>
      </form>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </div>
  );
}

function CategoryRow({ c, count, lang, onRename, onRemove }: {
  c: Category; count: number; lang: "th" | "en";
  onRename: (c: Category, th: string, en: string) => void; onRemove: (c: Category) => void;
}) {
  const { t } = useOps();
  const [edit, setEdit] = useState(false);
  const [th, setTh] = useState(c.name_th);
  const [en, setEn] = useState(c.name_en);
  return (
    <li className={c.parent_code ? "cat-list__sub" : undefined}>
      {edit ? (
        <div className="row">
          <input aria-label={t.itm.nameTh} value={th} onChange={(e) => setTh(e.target.value)} />
          <input aria-label={t.itm.nameEn} value={en} onChange={(e) => setEn(e.target.value)} />
          <button type="button" className="btn btn--small" onClick={() => { onRename(c, th, en); setEdit(false); }}>{t.save}</button>
        </div>
      ) : (
        <div className="row row--between">
          <span>
            <strong>{lang === "th" ? c.name_th : c.name_en}</strong>{" "}
            <span className="muted small">{t.kinds[c.kind]} · {fmt(t.itm.items, { n: fq(count) })}{c.system ? ` · ${t.itm.system}` : ""}</span>
          </span>
          <span className="row">
            <button type="button" className="btn btn--small" onClick={() => setEdit(true)}>{t.itm.edit}</button>
            {!c.system && count === 0 && <button type="button" className="btn btn--small btn--danger" onClick={() => onRemove(c)}>{t.itm.deleteCategory}</button>}
          </span>
        </div>
      )}
    </li>
  );
}
