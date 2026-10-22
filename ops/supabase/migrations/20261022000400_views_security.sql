-- Balena operations: reporting views, the dashboard summary, and access rules.
-- Reporting rule: a reversed record and its reversal cancel out, so totals use posted records that
-- are not reversals (status = 'posted' and reverses_doc is null). Ledger totals net out by themselves.

-- ---------- views (security_invoker: they obey the caller's access rules) ----------

create view public.stock_on_hand with (security_invoker = true) as
select m.item_id, i.code, i.name_en, i.name_th, i.kind, i.base_unit, m.location_code,
  sum(m.qty) as qty,
  c.avg_cost,
  case when c.avg_cost is null then null else round(sum(m.qty) * c.avg_cost, 2) end as value,
  i.min_level
from public.stock_moves m
join public.stock_items i on i.id = m.item_id
left join public.item_costs c on c.item_id = m.item_id
group by m.item_id, i.code, i.name_en, i.name_th, i.kind, i.base_unit, m.location_code, c.avg_cost, i.min_level
having sum(m.qty) <> 0;

create view public.account_balances with (security_invoker = true) as
select a.code, a.name, a.holder, a.kind, coalesce(sum(m.amount), 0) as balance, max(m.move_date) as last_move
from public.accounts a left join public.money_moves m on m.account_code = a.code
group by a.code, a.name, a.holder, a.kind;

create view public.partner_balances with (security_invoker = true) as
select p.id as member_id, p.display_name,
  coalesce(sum(m.amount) filter (where m.kind in ('contribution', 'drawing')), 0) as equity,
  coalesce(sum(m.amount) filter (where m.kind in ('paid_for_business', 'reimbursed')), 0) as owed_to_partner
from public.members p left join public.partner_moves m on m.member_id = p.id
where p.role in ('owner', 'partner')
group by p.id, p.display_name;

-- Money expected in: sales paid later (marketplace payouts) and consignment reports.
create view public.receivables with (security_invoker = true) as
with due as (
  select d.id, d.doc_no, d.doc_type, d.doc_date, d.data ->> 'channel' as channel,
    case when d.doc_type = 'consignment' then (d.data ->> 'amount_due')::numeric else d.total end as amount_due,
    case when d.doc_type = 'consignment' then (d.data ->> 'due_date')::date end as due_date
  from public.documents d
  where d.status = 'posted' and d.reverses_doc is null
    and (d.doc_type = 'consignment' or (d.doc_type = 'sale' and d.data ->> 'paid' in ('payout', 'unpaid')))
), paid as (
  select (p.data ->> 'for_doc')::uuid as for_doc, sum(p.total) as received, bool_or((p.data ->> 'close')::boolean) as closed
  from public.documents p
  where p.doc_type = 'payment' and p.status = 'posted' and p.reverses_doc is null and p.data ->> 'direction' = 'in'
  group by 1
)
select due.*, coalesce(paid.received, 0) as received,
  case when coalesce(paid.closed, false) then 0 else due.amount_due - coalesce(paid.received, 0) end as open_amount,
  case when coalesce(paid.closed, false) then due.amount_due - coalesce(paid.received, 0) else 0 end as settlement_fee
from due left join paid on paid.for_doc = due.id;

-- Bills recorded as unpaid.
create view public.payables with (security_invoker = true) as
select d.id, d.doc_no, d.doc_type, d.doc_date, d.data ->> 'supplier' as supplier, d.data ->> 'category' as category, d.total,
  coalesce((select sum(p.total) from public.documents p where p.doc_type = 'payment' and p.status = 'posted' and p.reverses_doc is null
    and p.data ->> 'direction' = 'out' and (p.data ->> 'for_doc')::uuid = d.id), 0) as paid
from public.documents d
where d.doc_type in ('purchase', 'expense') and d.status = 'posted' and d.reverses_doc is null and d.data ->> 'paid' = 'unpaid';

-- Monthly figures. Each measure says whether it is complete.
create or replace function public.month_summary(p_month date, p_channel text default null, p_location text default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  m0 date := date_trunc('month', p_month)::date;
  m1 date := (date_trunc('month', p_month) + interval '1 month')::date;
  sales numeric; cogs numeric; cogs_unknown integer; fees numeric; fee_unknown integer; opex numeric; ads numeric;
  cash numeric; pending integer; recv numeric; payab numeric;
begin
  select coalesce(sum(d.total), 0) into sales from public.documents d
  where d.doc_type in ('sale', 'consignment') and d.status = 'posted' and d.reverses_doc is null and d.doc_date >= m0 and d.doc_date < m1
    and (p_channel is null or d.data ->> 'channel' = p_channel) and (p_location is null or d.location_code = p_location);

  select coalesce(-sum(sm.value), 0), count(*) filter (where sm.unit_cost is null) into cogs, cogs_unknown
  from public.stock_moves sm join public.documents d on d.id = sm.doc_id
  where sm.kind in ('sale', 'sale_reversed') and sm.move_date >= m0 and sm.move_date < m1
    and (p_channel is null or d.data ->> 'channel' = p_channel or (d.reverses_doc is not null and exists
      (select 1 from public.documents o where o.id = d.reverses_doc and o.data ->> 'channel' = p_channel)))
    and (p_location is null or sm.location_code = p_location);

  -- Channel costs: consignment GP plus settled marketplace fees. Unsettled online sales whose fee isn't
  -- confirmed make the figure incomplete.
  select coalesce(sum((d.data ->> 'gp_amount')::numeric), 0) into fees from public.documents d
  where d.doc_type = 'consignment' and d.status = 'posted' and d.reverses_doc is null and d.doc_date >= m0 and d.doc_date < m1
    and (p_channel is null or d.data ->> 'channel' = p_channel);
  select fees + coalesce(sum(r.settlement_fee), 0), count(*) filter (where r.doc_type = 'sale' and r.open_amount > 0)
    into fees, fee_unknown
  from public.receivables r where r.doc_date >= m0 and r.doc_date < m1 and (p_channel is null or r.channel = p_channel);

  select coalesce(sum(d.total) filter (where d.data ->> 'category' <> 'advertising'), 0),
         coalesce(sum(d.total) filter (where d.data ->> 'category' = 'advertising'), 0)
    into opex, ads from public.documents d
  where d.doc_type = 'expense' and d.status = 'posted' and d.reverses_doc is null and d.doc_date >= m0 and d.doc_date < m1
    and (p_location is null or d.location_code = p_location or d.location_code is null);

  select coalesce(sum(balance), 0) into cash from public.account_balances;
  select count(*) into pending from public.documents where status = 'pending';
  select coalesce(sum(open_amount), 0) into recv from public.receivables;
  select coalesce(sum(total - paid), 0) into payab from public.payables;

  return jsonb_build_object(
    'month', m0, 'net_sales', sales,
    'cogs', cogs, 'cogs_complete', cogs_unknown = 0, 'cogs_unknown_lines', cogs_unknown,
    'gross_profit', case when cogs_unknown = 0 then sales - cogs end,
    'channel_fees', fees, 'fees_complete', fee_unknown = 0, 'unsettled_online_sales', fee_unknown,
    'contribution', case when cogs_unknown = 0 and fee_unknown = 0 then sales - cogs - fees end,
    'operating_expenses', opex, 'advertising', ads,
    'operating_profit', case when cogs_unknown = 0 and fee_unknown = 0 then sales - cogs - fees - opex - ads end,
    'cash_balance', cash, 'pending_approvals', pending, 'open_receivables', recv, 'open_payables', payab);
end $$;

-- ---------- access rules ----------

-- Applied after 001: pin the error helper's search path too.
alter function private.fail(text, jsonb) set search_path = '';

alter table public.members enable row level security;
alter table public.locations enable row level security;
alter table public.accounts enable row level security;
alter table public.channels enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;
alter table public.stock_items enable row level security;
alter table public.unit_conversions enable row level security;
alter table public.prices enable row level security;
alter table public.periods enable row level security;
alter table public.item_costs enable row level security;
alter table public.stock_moves enable row level security;
alter table public.money_moves enable row level security;
alter table public.partner_moves enable row level security;
alter table public.documents enable row level security;
alter table public.doc_lines enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.members, public.locations, public.accounts, public.channels, public.settings,
  public.stock_items, public.unit_conversions to authenticated;

-- Everyone in the team sees the operational records.
create policy read on public.members for select to authenticated using (private.is_member());
create policy read on public.locations for select to authenticated using (private.is_member());
create policy read on public.channels for select to authenticated using (private.is_member());
create policy read on public.stock_items for select to authenticated using (private.is_member());
create policy read on public.unit_conversions for select to authenticated using (private.is_member());
create policy read on public.periods for select to authenticated using (private.is_member());
create policy read on public.stock_moves for select to authenticated using (private.is_member());
create policy read on public.settings for select to authenticated using (private.is_member());
create policy read on public.documents for select to authenticated
  using (private.sees_money() or (private.is_member() and doc_type in ('production', 'transfer', 'count', 'sale')));
create policy read on public.doc_lines for select to authenticated
  using (exists (select 1 from public.documents d where d.id = doc_id));

-- Account names (never numbers) are visible to everyone so staff can record shop cash sales;
-- balances come from money_moves, which staff can't read.
create policy read on public.accounts for select to authenticated using (private.is_member());

-- Money, costs and history: owner and partners only.
create policy read on public.prices for select to authenticated using (private.sees_money());
create policy read on public.item_costs for select to authenticated using (private.sees_money());
create policy read on public.money_moves for select to authenticated using (private.sees_money());
create policy read on public.partner_moves for select to authenticated using (private.sees_money());
create policy read on public.audit_log for select to authenticated using (private.sees_money());

-- Master data: the owner adds and edits (never deletes; set active = false instead).
create policy owner_insert on public.members for insert to authenticated with check (private.is_owner());
create policy owner_update on public.members for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy owner_insert on public.locations for insert to authenticated with check (private.is_owner());
create policy owner_update on public.locations for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy owner_insert on public.accounts for insert to authenticated with check (private.is_owner());
create policy owner_update on public.accounts for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy owner_insert on public.channels for insert to authenticated with check (private.is_owner());
create policy owner_update on public.channels for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy owner_insert on public.settings for insert to authenticated with check (private.is_owner());
create policy owner_update on public.settings for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy owner_insert on public.stock_items for insert to authenticated with check (private.is_owner());
create policy owner_update on public.stock_items for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy owner_insert on public.unit_conversions for insert to authenticated with check (private.is_owner());
create policy owner_update on public.unit_conversions for update to authenticated using (private.is_owner()) with check (private.is_owner());

-- Functions: only the public ones are callable, and only by signed-in users.
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_member(), private.is_owner(), private.sees_money(), private.member_id(), private.member_role()
  to authenticated;
revoke all on all functions in schema public from public, anon;
grant execute on function public.post_document(jsonb), public.decide_document(uuid, boolean, text),
  public.receive_transfer(uuid, date, jsonb, text), public.reverse_document(uuid, date, text),
  public.dispute_document(uuid, text, boolean), public.propose_price(uuid, text, numeric, date, text),
  public.decide_price(uuid, boolean), public.close_month(date, boolean), public.on_hand(uuid, text),
  public.month_summary(date, text, text) to authenticated;

-- ---------- receipts (private file storage) ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and private.is_member());
create policy receipts_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and private.is_member());
