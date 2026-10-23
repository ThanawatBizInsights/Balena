// Operations app shell: sign-in, team check, navigation and routing (#/path).
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { setLang, useDocumentLang, useLang } from "../i18n/lang";
import { opsText } from "../i18n/ops";
import { db, errorText, fmt, loadRef, seesMoney, type Ref } from "./api";
import { Field, Notice, OpsCtx, type Ctx } from "./ui";
import { NewRecord, RecordForm } from "./forms";
import { Approvals, RecordDetail, Records, StockPage } from "./pages";
import { Overview } from "./overview";
import { BusinessReport } from "./report";
import { Settings } from "./settings";

function useHash() {
  const [hash, setHash] = useState(() => location.hash.replace(/^#/, "") || "/");
  useEffect(() => {
    const on = () => { setHash(location.hash.replace(/^#/, "") || "/"); window.scrollTo(0, 0); };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function App() {
  const lang = useLang();
  const t = opsText[lang];
  useDocumentLang(lang, t.meta);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);
  const [ref, setRef] = useState<Ref | null | undefined>(undefined);
  const [refError, setRefError] = useState<unknown>(null);

  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const reloadRef = useCallback(async () => {
    if (!userId) return;
    try { setRef(await loadRef(userId)); setRefError(null); } catch (e) { setRefError(e); }
  }, [userId]);
  useEffect(() => { if (userId) { setRef(undefined); reloadRef(); } else setRef(undefined); }, [userId, reloadRef]);

  const langButton = (
    <button type="button" className="lang" onClick={() => setLang(lang === "th" ? "en" : "th")} lang={lang === "th" ? "en" : "th"}>
      {lang === "th" ? "English" : "ภาษาไทย"}
    </button>
  );

  if (session === undefined) return <main className="center">{t.loading}</main>;
  if (recovery && session) return <Shell lang={langButton} t={t}><NewPassword t={t} done={() => setRecovery(false)} /></Shell>;
  if (!session) return <Shell lang={langButton} t={t}><SignIn t={t} /></Shell>;
  if (refError) return <Shell lang={langButton} t={t}><Notice kind="error">{errorText(t, refError)}</Notice><button type="button" onClick={reloadRef}>↻</button></Shell>;
  if (ref === undefined) return <main className="center">{t.loading}</main>;
  if (ref === null) {
    return (
      <Shell lang={langButton} t={t}>
        <Notice kind="info">{fmt(t.auth.notMember, { email: session.user.email })}</Notice>
        <button type="button" className="btn" onClick={() => db.auth.signOut()}>{t.auth.signOut}</button>
      </Shell>
    );
  }
  return <Signed t={t} lang={lang} ref_={ref} reloadRef={reloadRef} langButton={langButton} />;
}

function Shell({ t, lang, children }: { t: typeof opsText.th; lang: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="top"><span className="top__brand">{t.brand}</span>{lang}</header>
      <main className="page page--narrow">{children}</main>
    </div>
  );
}

function Signed({ t, lang, ref_, reloadRef, langButton }: { t: typeof opsText.th; lang: Ctx["lang"]; ref_: Ref; reloadRef: () => Promise<void>; langButton: React.ReactNode }) {
  const hash = useHash();
  const go = useCallback((h: string) => { location.hash = h; }, []);
  const ctx: Ctx = { t, lang, ref: ref_, reloadRef, go };
  const me = ref_.me;
  const [pending, setPending] = useState(0);
  useEffect(() => {
    db.from("documents").select("id", { count: "exact", head: true }).eq("status", "pending").then(({ count }) => setPending(count ?? 0));
  }, [hash]);

  const parts = hash.split("/").filter(Boolean);
  let view: React.ReactNode;
  if (parts[0] === "new" && parts[1]) view = <RecordForm type={parts[1]} key={parts[1]} />;
  else if (parts[0] === "new") view = <NewRecord />;
  else if (parts[0] === "records") view = <Records />;
  else if (parts[0] === "record" && parts[1]) view = <RecordDetail id={parts[1]} fresh={parts[2] === "new"} key={hash} />;
  else if (parts[0] === "report") view = <BusinessReport />;
  else if (parts[0] === "stock") view = <StockPage />;
  else if (parts[0] === "approvals") view = <Approvals />;
  else if (parts[0] === "settings" && me.role === "owner") view = <Settings />;
  else view = <Overview />;

  const nav: [string, string, number?][] = [
    ["/", t.nav.home],
    ...(seesMoney(me.role) ? [["/report", t.nav.report] as [string, string]] : []),
    ["/new", t.nav.new],
    ["/records", t.nav.records],
    ["/stock", t.nav.stock],
    ...(seesMoney(me.role) ? [["/approvals", t.nav.approvals, pending] as [string, string, number]] : []),
    ...(me.role === "owner" ? [["/settings", t.nav.settings] as [string, string]] : []),
  ];
  const active = "/" + (parts[0] === "record" ? "records" : parts[0] ?? "");

  return (
    <OpsCtx.Provider value={ctx}>
      <div className="shell">
        <header className="top">
          <a className="top__brand" href="#/">{t.brand}</a>
          <span className="top__me">{me.display_name}</span>
          {langButton}
          <button type="button" className="link" onClick={() => db.auth.signOut()}>{t.auth.signOut}</button>
        </header>
        <nav className="nav" aria-label={t.brand}>
          {nav.map(([h, label, n]) => (
            <a key={h} href={`#${h}`} aria-current={active === (h === "/" ? "/" : h) ? "page" : undefined}>
              {label}{n ? <span className="nav__count">{n}</span> : null}
            </a>
          ))}
        </nav>
        <p className="testband">{t.openingBanner}</p>
        <main className="page">{view}</main>
      </div>
    </OpsCtx.Provider>
  );
}

function SignIn({ t }: { t: typeof opsText.th }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const redirect = `${location.origin}/ops/`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (mode === "in") {
      const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setMsg({ kind: "error", text: t.auth.failed });
    } else {
      const { error } = await db.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect } });
      setMsg(error ? { kind: "error", text: errorText(t, error) } : { kind: "ok", text: t.auth.sentConfirm });
    }
    setBusy(false);
  };
  const forgot = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await db.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect });
    setMsg(error ? { kind: "error", text: errorText(t, error) } : { kind: "ok", text: t.auth.sentReset });
    setBusy(false);
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h1>{mode === "in" ? t.auth.title : t.auth.signUp}</h1>
      <p>{t.auth.intro}</p>
      <Field label={t.auth.email}>{(id) => <input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label={mode === "in" ? t.auth.password : t.auth.newPassword}>
        {(id) => <input id={id} type="password" minLength={8} required autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <button className="btn btn--primary" disabled={busy}>{mode === "in" ? t.auth.signIn : t.auth.signUp}</button>
      <div className="row">
        <button type="button" className="link" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }}>
          {mode === "in" ? t.auth.toSignUp : t.auth.toSignIn}
        </button>
        {mode === "in" && <button type="button" className="link" onClick={forgot} disabled={busy}>{t.auth.forgot}</button>}
      </div>
    </form>
  );
}

function NewPassword({ t, done }: { t: typeof opsText.th; done: () => void }) {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await db.auth.updateUser({ password });
    if (error) setMsg(errorText(t, error)); else done();
  };
  return (
    <form className="card form" onSubmit={submit}>
      <h1>{t.auth.setPassword}</h1>
      <Field label={t.auth.newPassword}>{(id) => <input id={id} type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
      {msg && <Notice kind="error">{msg}</Notice>}
      <button className="btn btn--primary">{t.auth.setPassword}</button>
    </form>
  );
}
