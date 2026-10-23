// Administrator settings: team, approval limits, channels, products and materials, prices, months.
// The team list has no business roles: every active member uses the same workflow. The member
// marked as administrator in the database (role "owner") manages these settings and approvals.
// Master data is edited directly (row-level security allows only the owner); every change is
// written to the audit log by the database. Prices go through propose_price()/decide_price().
import { useState, type FormEvent } from "react";
import { db, errorText, fmt, money, today, useQuery } from "./api";
import { Field, Notice, NumberInput, Select, itemName, useNames, useOps } from "./ui";

export function Settings() {
  const { t } = useOps();
  return (
    <section>
      <h1>{t.nav.settings}</h1>
      <Team />
      <Limits />
      <Channels />
      <Prices />
      <Months />
    </section>
  );
}

function useSaver() {
  const { t, reloadRef } = useOps();
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setMsg(null);
    const { error } = await fn();
    if (error) setMsg({ kind: "error", text: errorText(t, error) });
    else { setMsg({ kind: "ok", text: t.settings.saved }); await reloadRef(); }
    return !error;
  };
  return { msg, run };
}

function Team() {
  const { t, ref } = useOps();
  const names = useNames();
  const { msg, run } = useSaver();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [home, setHome] = useState("CK");
  const locs = ref.locations.filter((l) => l.kind === "own").map((l) => ({ value: l.code, label: names.loc(l.code) }));
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => db.from("members").insert({ email: email.trim().toLowerCase(), display_name: name.trim(), home_location: home }))) {
      setEmail(""); setName("");
    }
  };
  return (
    <div className="card">
      <h2>{t.settings.members}</h2>
      <div className="scroll">
        <table className="table">
          <thead><tr><th>{t.settings.name}</th><th>{t.auth.email}</th><th>{t.settings.homeLocation}</th><th>{t.settings.active}</th></tr></thead>
          <tbody>
            {ref.members.map((m) => (
              <tr key={m.id}>
                <td>{m.display_name}<br /><span className="muted">{m.user_id ? t.settings.linked : t.settings.notLinked}</span></td>
                <td>{m.email}</td>
                <td>
                  <select aria-label={`${t.settings.homeLocation} ${m.display_name}`} value={m.home_location ?? ""}
                    onChange={(e) => run(() => db.from("members").update({ home_location: e.target.value || null }).eq("id", m.id))}>
                    <option value="">–</option>
                    {locs.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </td>
                <td>
                  <input type="checkbox" aria-label={`${t.settings.active} ${m.display_name}`} checked={m.active} disabled={m.id === ref.me.id}
                    onChange={(e) => run(() => db.from("members").update({ active: e.target.checked }).eq("id", m.id))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="grid" onSubmit={add}>
        <Field label={t.auth.email}>{(id) => <input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label={t.settings.name}>{(id) => <input id={id} required value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label={t.settings.homeLocation}>{(id) => <Select id={id} value={home} onChange={setHome} options={locs} />}</Field>
        <div className="field"><button className="btn btn--primary">{t.settings.addMember}</button></div>
      </form>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </div>
  );
}

function Limits() {
  const { t, ref } = useOps();
  const { msg, run } = useSaver();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(ref.settings.map((s) => [s.key, s.value == null ? "" : String(s.value)])));
  const save = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      for (const s of ref.settings) {
        const v = values[s.key]?.trim() ?? "";
        const next = v === "" ? null : Number(v);
        if (next !== (s.value == null ? null : Number(s.value))) {
          const r = await db.from("settings").update({ value: next, updated_by: ref.me.id, updated_at: new Date().toISOString() }).eq("key", s.key);
          if (r.error) return r;
        }
      }
      return { error: null };
    });
  };
  const labels = t.settings.limitKeys as Record<string, string>;
  return (
    <form className="card" onSubmit={save}>
      <h2>{t.settings.limits}</h2>
      <p className="muted">{t.settings.limitsHint}</p>
      <div className="grid">
        {ref.settings.map((s) => (
          <Field key={s.key} label={labels[s.key] ?? s.key}>{(id) => <NumberInput id={id} value={values[s.key] ?? ""} onChange={(v) => setValues({ ...values, [s.key]: v })} />}</Field>
        ))}
      </div>
      <button className="btn btn--primary">{t.save}</button>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </form>
  );
}

function Channels() {
  const { t, ref } = useOps();
  const { msg, run } = useSaver();
  return (
    <div className="card">
      <h2>{t.settings.channels}</h2>
      <div className="scroll">
        <table className="table">
          <thead><tr><th>{t.f.channel}</th><th className="n">{t.settings.fee}</th><th>{t.settings.feeConfirmed}</th><th className="n">{t.settings.settleDays}</th></tr></thead>
          <tbody>
            {ref.channels.map((c) => (
              <tr key={c.code}>
                <td>{c.name}</td>
                <td className="n">
                  <input className="cell" type="number" min="0" max="100" step="any" aria-label={`${t.settings.fee} ${c.name}`} defaultValue={c.fee_percent ?? ""}
                    onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== (c.fee_percent == null ? null : Number(c.fee_percent))) run(() => db.from("channels").update({ fee_percent: v }).eq("code", c.code)); }} />
                </td>
                <td><input type="checkbox" aria-label={`${t.settings.feeConfirmed} ${c.name}`} checked={c.fee_confirmed}
                  onChange={(e) => run(() => db.from("channels").update({ fee_confirmed: e.target.checked }).eq("code", c.code))} /></td>
                <td className="n">
                  <input className="cell" type="number" min="0" step="1" aria-label={`${t.settings.settleDays} ${c.name}`} defaultValue={c.settles_days ?? ""}
                    onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== c.settles_days) run(() => db.from("channels").update({ settles_days: v }).eq("code", c.code)); }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </div>
  );
}

function Prices() {
  const { t, ref, lang } = useOps();
  const { msg, run } = useSaver();
  const [item, setItem] = useState("");
  const [channel, setChannel] = useState("");
  const [price, setPrice] = useState("");
  const [from, setFrom] = useState(today);
  const [source, setSource] = useState("");
  const products = ref.items.filter((i) => i.kind === "product" && i.active);
  const current = ref.prices.filter((p) => p.status === "approved" && !p.valid_to);
  const pending = ref.prices.filter((p) => p.status === "pending");
  const names = useNames();
  const propose = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => db.rpc("propose_price", { p_item: item, p_channel: channel, p_price: Number(price), p_from: from, p_source: source || null }))) { setPrice(""); setSource(""); }
  };
  return (
    <div className="card">
      <h2>{t.settings.prices}</h2>
      <div className="scroll">
        <table className="table">
          <thead><tr><th>{t.f.product}</th><th>{t.f.channel}</th><th className="n">{t.settings.price}</th><th>{t.settings.validFrom}</th><th>{t.settings.source}</th></tr></thead>
          <tbody>
            {current.map((p) => (
              <tr key={p.id}><td>{names.item(p.item_id)}</td><td>{names.channel(p.channel_code)}</td><td className="n">{money(p.price)}</td><td>{p.valid_from}</td><td className="muted">{p.source}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {pending.length > 0 && (
        <>
          <h3>{t.settings.pendingPrices}</h3>
          <ul className="plain">
            {pending.map((p) => (
              <li key={p.id} className="row">
                {names.item(p.item_id)} · {names.channel(p.channel_code)} · {fmt(t.baht, { n: money(p.price) })} · {p.valid_from}
                <button type="button" className="btn btn--small" onClick={() => run(() => db.rpc("decide_price", { p_id: p.id, p_approve: true }))}>{t.records.approve}</button>
                <button type="button" className="btn btn--small" onClick={() => run(() => db.rpc("decide_price", { p_id: p.id, p_approve: false }))}>{t.records.reject}</button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>{t.settings.proposePrice}</h3>
      <form className="grid" onSubmit={propose}>
        <Field label={t.f.product}>{(id) => <Select id={id} value={item} onChange={setItem} placeholder="—" options={products.map((i) => ({ value: i.id, label: itemName(lang, i) }))} />}</Field>
        <Field label={t.f.channel}>{(id) => <Select id={id} value={channel} onChange={setChannel} placeholder="—" options={ref.channels.map((c) => ({ value: c.code, label: c.name }))} />}</Field>
        <Field label={t.settings.price}>{(id) => <NumberInput id={id} value={price} onChange={setPrice} />}</Field>
        <Field label={t.settings.validFrom}>{(id) => <input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
        <Field label={`${t.settings.source} ${t.optional}`}>{(id) => <input id={id} value={source} onChange={(e) => setSource(e.target.value)} />}</Field>
        <div className="field"><button className="btn btn--primary">{t.settings.proposePrice}</button></div>
      </form>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </div>
  );
}

function Months() {
  const { t } = useOps();
  const [month, setMonth] = useState(today().slice(0, 7));
  const periods = useQuery<{ month: string; closed_at: string | null }[]>(() => db.from("periods").select("month,closed_at").order("month", { ascending: false }), []);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const closed = (periods.data ?? []).find((p) => p.month.startsWith(month))?.closed_at;
  const toggle = async () => {
    const { error } = await db.rpc("close_month", { p_month: `${month}-01`, p_close: !closed });
    setMsg(error ? { kind: "error", text: errorText(t, error) } : { kind: "ok", text: t.settings.saved });
    periods.reload();
  };
  return (
    <div className="card">
      <h2>{t.settings.months}</h2>
      <p className="muted">{t.settings.monthsHint}</p>
      <div className="row">
        <Field label={t.home.month}>{(id) => <input id={id} type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />}</Field>
        <button type="button" className={closed ? "btn" : "btn btn--danger"} onClick={toggle}>{closed ? t.settings.reopenMonth : t.settings.closeMonth}</button>
      </div>
      {(periods.data ?? []).filter((p) => p.closed_at).map((p) => <p key={p.month} className="muted">{p.month.slice(0, 7)} · {t.settings.closed}</p>)}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </div>
  );
}
