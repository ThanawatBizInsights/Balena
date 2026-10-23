// Data access for the operations app. Everything goes through the signed-in user's own client,
// so the database's access rules decide what each person sees and can do. Records are written
// only with post_document() and the other database functions, never by editing tables.
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { OPS_SUPABASE } from "../config/ops";
import type { OpsText } from "../i18n/ops";

export const db = createClient(OPS_SUPABASE.url, OPS_SUPABASE.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type Role = "owner" | "partner" | "staff";
export type DocType = "sale" | "expense" | "purchase" | "production" | "transfer" | "count" | "consignment" | "payment" | "partner" | "opening";
export type Status = "pending" | "posted" | "rejected" | "reversed";
export type ItemKind = "green_bean" | "roasted_bean" | "ingredient" | "packaging" | "product";

export interface Member { id: string; user_id: string | null; email: string; display_name: string; role: Role; home_location: string | null; active: boolean }
export interface Location { code: string; name_th: string; name_en: string; kind: "own" | "consignment" | "transit"; active: boolean }
export interface Account { code: string; name: string; holder: string | null; kind: "bank" | "cash"; active: boolean }
export interface Channel { code: string; name: string; kind: "shop" | "online" | "consignment" | "delivery"; fee_percent: number | null; fee_confirmed: boolean; settles_days: number | null; active: boolean }
export interface Item {
  id: string; code: string; name_en: string; name_th: string; kind: ItemKind; base_unit: "g" | "mL" | "pc";
  category: string | null; size_value: number | null; size_unit: string | null; pack: string | null; size_confirmed: boolean;
  iconsiam_code: string | null; barcode: string | null; min_level: number | null; active: boolean; version: number;
}
export interface Price { id: string; item_id: string; channel_code: string; price: number; valid_from: string; valid_to: string | null; status: string; source: string | null }
export interface Doc {
  id: string; doc_no: string; doc_type: DocType; doc_date: string; location_code: string | null; status: Status;
  total: number | null; data: Record<string, unknown>; note: string | null; attachments: string[]; needs_approval: boolean;
  approved_by: string | null; approved_at: string | null; decision_note: string | null; reverses_doc: string | null;
  reversed_by_doc: string | null; disputed: boolean; dispute_note: string | null; created_by: string; created_at: string;
}
export interface DocLine { id: string; doc_id: string; line_no: number; item_id: string | null; qty: number | null; unit_price: number | null; amount: number | null; extra: Record<string, unknown> }
export interface StockRow { item_id: string; code: string; name_en: string; name_th: string; kind: ItemKind; base_unit: string; location_code: string; qty: number; avg_cost: number | null; value: number | null; min_level: number | null }
export interface Setting { key: string; value: number | null; note: string | null }
export interface AuditRow { id: number; at: string; member_id: string | null; action: string; table_name: string; record_id: string; old_values: unknown; new_values: unknown; reason: string | null }
export interface OpenRecord { id: string; doc_no: string; doc_type: string; doc_date: string; channel?: string | null; supplier?: string | null; amount_due?: number; open_amount?: number; total?: number; paid?: number }

/** Reference lists every screen needs; loaded once after sign-in and refreshed after changes. */
export interface Ref {
  me: Member;
  members: Member[];
  locations: Location[];
  accounts: Account[];
  channels: Channel[];
  items: Item[];
  settings: Setting[];
  prices: Price[];
}

export const seesMoney = (r: Role) => r === "owner" || r === "partner";

export async function loadRef(userId: string): Promise<Ref | null> {
  const [members, locations, accounts, channels, items, settings, prices] = await Promise.all([
    db.from("members").select("*").order("display_name"),
    db.from("locations").select("*").order("code"),
    db.from("accounts").select("*").order("code"),
    db.from("channels").select("*").order("kind").order("name"),
    db.from("stock_items").select("*").order("kind").order("name_en"),
    db.from("settings").select("*").order("key"),
    db.from("prices").select("*").order("valid_from", { ascending: false }),
  ]);
  const first = [members, locations, accounts, channels, items, settings, prices].find((r) => r.error);
  if (first?.error) throw first.error;
  const me = (members.data as Member[]).find((m) => m.user_id === userId && m.active);
  if (!me) return null;
  return {
    me,
    members: members.data as Member[],
    locations: locations.data as Location[],
    accounts: accounts.data as Account[],
    channels: channels.data as Channel[],
    items: items.data as Item[],
    settings: settings.data as Setting[],
    prices: (prices.data ?? []) as Price[],
  };
}

/** The approved price for a product on a channel at a date, if one is set. */
export function priceFor(ref: Ref, itemId: string, channel: string, date: string): number | null {
  const p = ref.prices.find((x) => x.status === "approved" && x.item_id === itemId && x.channel_code === channel
    && x.valid_from <= date && (!x.valid_to || x.valid_to >= date));
  return p ? Number(p.price) : null;
}

/** Runs a query and keeps its result, error and a reload function. */
export function useQuery<T>(run: () => PromiseLike<{ data: T | null; error: unknown }>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({ data: null, error: null, loading: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    Promise.resolve(run()).then(
      (r) => setState({ data: r.data, error: r.error, loading: false }),
      (e) => setState({ data: null, error: e, loading: false }),
    );
  }, deps);
  useEffect(load, [load]);
  return { ...state, reload: load };
}

export function fmt(s: string, vars: Record<string, string | number | null | undefined> = {}) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfQ = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
export const money = (n: number | string | null | undefined) => (n == null || n === "" ? "–" : nf2.format(Number(n)));
export const qty = (n: number | string | null | undefined) => (n == null || n === "" ? "–" : nfQ.format(Number(n)));

/** Today in Bangkok, as YYYY-MM-DD. */
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

/** Turns a database error into a sentence in the user's language. */
export function errorText(t: OpsText, err: unknown): string {
  const e = err as { message?: string; details?: string } | null;
  const msg = e?.message ?? String(err);
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return t.errors.offline;
  const m = /^balena:(\w+)/.exec(msg);
  if (m) {
    const key = m[1] as keyof OpsText["errors"];
    let detail: Record<string, string | number> = {};
    try { detail = e?.details ? JSON.parse(e.details) : {}; } catch { /* plain text detail */ }
    return fmt(t.errors[key] ?? fmt(t.errors.generic, { msg: key }), detail);
  }
  return fmt(t.errors.generic, { msg });
}

export function newKey() {
  return crypto.randomUUID();
}

/** Uploads a receipt photo to the private receipts store; returns its path. */
export async function uploadReceipt(file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-60);
  const path = `${today().slice(0, 7)}/${newKey()}-${safe}`;
  const { error } = await db.storage.from("receipts").upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error("balena:upload_failed");
  return path;
}

export async function receiptUrl(path: string) {
  const { data } = await db.storage.from("receipts").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/** What business_report() returns (see ops/supabase/migrations/20261023000200_business_report.sql). */
export interface BusinessReportData {
  from: string; to: string; channel: string | null; has_records: boolean;
  units: number; gross_sales: number; discounts: number; net_sales: number;
  returns: { count: number; amount: number };
  gp: number; settled_fees: number; fees_unknown_orders: number; fees_complete: boolean; after_channel: number;
  receivable: { expected: number; received: number; open: number; unconfirmed_count: number; unconfirmed_amount: number };
  cash_received: number;
  cogs: number | null; cogs_known_part: number; cogs_unknown_lines: number; cogs_complete: boolean;
  expenses: number; advertising: number;
  profit: number | null; profit_missing: ("costs" | "fees" | "channel_filter")[];
  opening_posted: boolean; cash_balance: number | null;
  stock_unreconciled: number; pending_approvals: number; low_stock: number; latest_sales_date: string | null;
  by_channel: { channel: string; units: number; net: number }[];
  by_product: { item_id: string; name_th: string; name_en: string; units: number; net: number }[];
  by_month: { month: string; units: number; net: number }[];
  sources: {
    id: string; doc_no: string; doc_type: string; doc_date: string; channel: string | null; report_no: string | null;
    branch_name: string | null; period_start: string | null; period_end: string | null; generated_at: string | null;
    source: { file?: string; type?: string } | null; stock: string | null; net_sales: number; gp: number | null;
    amount_due: number | null; received: number | null; open_amount: number | null;
    receipt_status: "unconfirmed" | "partly_received" | "settled" | "paid_at_sale"; units: number;
  }[];
}

export function businessReport(from: string, to: string, channel?: string | null) {
  return db.rpc("business_report", { p_from: from, p_to: to, p_channel: channel || null }) as unknown as PromiseLike<{ data: BusinessReportData | null; error: unknown }>;
}

/** First and last day of a YYYY-MM month. */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** YYYY-MM moved by n months. */
export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
