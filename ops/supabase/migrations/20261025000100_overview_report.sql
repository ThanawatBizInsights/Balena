-- Overview dashboard data: one month (or any range), optionally one branch (location).
--
-- Read-only, security invoker: RLS decides what the caller sees, exactly like business_report().
-- business_report() is unchanged; the Business Report page keeps using it.
--
-- Rules:
-- - Sales count on the sale/report date: a consignment report's period end when it has one,
--   otherwise the record date. An August ICONSIAM report paid in October is August sales.
-- - Cash received counts money that actually arrived in the range, by the money movement's
--   date: paid-at-sale sales and incoming payments (reversals subtract). Transfers, owner
--   contributions and opening balances are not cash received.
-- - Expenses are operating expenses and advertising only. Stock purchases are reported
--   separately and never counted as expenses.
-- - Expenses and profit are company-wide: with a branch filter they are null (no data), never 0.
-- - Profit is null while any sold line has no cost or any platform fee is unknown.
-- - The account balance is today's total across all accounts, kept apart from the range.

create or replace function public.overview_report(p_from date, p_to date, p_location text default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  r jsonb;
begin
  with docs as (
    select d.*, d.data ->> 'channel' as channel
    from public.documents d
    where d.status = 'posted' and d.reverses_doc is null and d.doc_type in ('sale', 'consignment')
      and coalesce(nullif(d.data ->> 'period_end', '')::date, d.doc_date) between p_from and p_to
      and (p_location is null or d.location_code = p_location)
  ),
  lines as (
    select l.*, d.channel,
      (select -sum(m.value) from public.stock_moves m
        where m.doc_id = l.doc_id and m.item_id = l.item_id and m.kind = 'sale' and m.unit_cost is not null) as cogs,
      exists (select 1 from public.stock_moves m
        where m.doc_id = l.doc_id and m.item_id = l.item_id and m.kind = 'sale' and m.provisional) as provisional
    from public.doc_lines l join docs d on d.id = l.doc_id
  ),
  recv as (
    select rv.*, d.doc_type as dtype from public.receivables rv join docs d on d.id = rv.id
  ),
  t as (
    select coalesce(sum(qty), 0) as units, coalesce(sum(amount), 0) as net, count(*) as line_count,
      count(*) filter (where cogs is null) as cogs_unknown, coalesce(sum(cogs), 0) as cogs_known,
      count(*) filter (where provisional) as provisional_lines
    from lines
  ),
  f as (
    select
      coalesce((select sum((data ->> 'gp_amount')::numeric) from docs where doc_type = 'consignment'), 0) as gp,
      coalesce((select sum(settlement_fee) from recv where dtype = 'sale'), 0) as fees,
      (select count(*) from recv where dtype = 'sale' and open_amount > 0) as fees_unknown
  ),
  cash as (
    select m.amount
    from public.money_moves m
    join public.documents d0 on d0.id = m.doc_id
    join public.documents d on d.id = coalesce(d0.reverses_doc, d0.id)
    left join public.documents fd on d.doc_type = 'payment' and fd.id = nullif(d.data ->> 'for_doc', '')::uuid
    where m.kind in ('sale', 'received', 'sale_reversed', 'received_reversed')
      and m.move_date between p_from and p_to
      and (p_location is null or coalesce(fd.location_code, d.location_code) = p_location)
  ),
  e as (
    select
      coalesce(sum(total) filter (where data ->> 'category' is distinct from 'advertising'), 0) as opex,
      coalesce(sum(total) filter (where data ->> 'category' = 'advertising'), 0) as ads,
      count(*) as n
    from public.documents
    where doc_type = 'expense' and status = 'posted' and reverses_doc is null and doc_date between p_from and p_to
  ),
  pur as (
    select coalesce(sum(total), 0) as total, count(*) as n
    from public.documents
    where doc_type = 'purchase' and status = 'posted' and reverses_doc is null and doc_date between p_from and p_to
      and (p_location is null or location_code = p_location)
  ),
  ch as (
    select d.channel,
      coalesce(sum((d.data ->> 'gp_amount')::numeric) filter (where d.doc_type = 'consignment'), 0) as gp,
      coalesce(sum(rv.settlement_fee) filter (where d.doc_type = 'sale'), 0) as fees,
      count(*) filter (where d.doc_type = 'sale' and rv.open_amount > 0) as fees_unknown,
      coalesce(sum(rv.amount_due), 0) as due, coalesce(sum(rv.received), 0) as received,
      coalesce(sum(rv.open_amount), 0) as open,
      coalesce(sum(d.total) filter (where rv.id is null), 0) as paid_at_sale
    from docs d left join public.receivables rv on rv.id = d.id
    group by d.channel
  ),
  opening as (
    select exists (select 1 from public.documents where doc_type = 'opening' and status = 'posted') as posted
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'location', p_location,
    'has_records', t.line_count > 0,
    'units', t.units, 'net_sales', t.net,
    'gp', f.gp, 'fees', f.fees, 'fees_unknown_orders', f.fees_unknown,
    'after_channel', t.net - f.gp - f.fees,
    'cash_received', (select coalesce(sum(amount), 0) from cash),
    'cash_moves', (select count(*) from cash),
    'expenses', case when p_location is null then e.opex + e.ads end,
    'operating_expenses', case when p_location is null then e.opex end,
    'advertising', case when p_location is null then e.ads end,
    'expense_records', e.n,
    'purchases', pur.total, 'purchase_records', pur.n,
    'cogs', case when t.cogs_unknown = 0 then t.cogs_known end,
    'cogs_unknown_lines', t.cogs_unknown,
    'profit', case when t.line_count > 0 and t.cogs_unknown = 0 and f.fees_unknown = 0 and p_location is null
      then t.net - f.gp - f.fees - t.cogs_known - e.opex - e.ads end,
    'profit_missing', to_jsonb(array_remove(array[
      case when t.line_count = 0 then 'no_sales' end,
      case when t.cogs_unknown > 0 then 'costs' end,
      case when f.fees_unknown > 0 then 'fees' end,
      case when p_location is not null then 'branch_filter' end], null)),
    'profit_provisional', t.provisional_lines > 0,
    'by_channel', coalesce((select jsonb_agg(x order by x.net desc) from (
        select c.channel, s.units, s.net, c.gp, c.fees, c.fees_unknown, c.due, c.received, c.open, c.paid_at_sale
        from ch c join (select channel, sum(qty) as units, sum(amount) as net from lines group by channel) s
          on s.channel is not distinct from c.channel) x), '[]'::jsonb),
    'by_product', coalesce((select jsonb_agg(x order by x.units desc, x.net desc) from (
        select l.item_id, i.name_th, i.name_en, sum(l.qty) as units, sum(l.amount) as net
        from lines l left join public.stock_items i on i.id = l.item_id
        group by l.item_id, i.name_th, i.name_en) x), '[]'::jsonb),
    'receivable', jsonb_build_object(
      'open', coalesce((select sum(open_amount) from recv), 0),
      'unconfirmed_count', (select count(*) from recv where received = 0 and open_amount > 0),
      'unconfirmed_amount', coalesce((select sum(open_amount) from recv where received = 0 and open_amount > 0), 0)),
    'attention', jsonb_build_object(
      'batches_pending', (select count(*) from public.documents where doc_type = 'production' and status = 'posted'
        and reverses_doc is null and data ->> 'materials' = 'pending'
        and (p_location is null or location_code = p_location)),
      'negative_stock', (select count(*) from public.stock_on_hand where qty < 0 and location_code <> 'TRANSIT'
        and (p_location is null or location_code = p_location)),
      'opening_posted', opening.posted,
      'stock_unreconciled', (select count(*) from docs where data ->> 'stock' = 'not_reconciled'),
      'pending_approvals', (select count(*) from public.documents where status = 'pending'
        and (p_location is null or location_code = p_location))),
    'cash_balance', case when opening.posted then (select coalesce(sum(balance), 0) from public.account_balances) end,
    'latest_sales_date', (select max(coalesce(nullif(data ->> 'period_end', '')::date, doc_date)) from public.documents
      where status = 'posted' and reverses_doc is null and doc_type in ('sale', 'consignment')
        and (p_location is null or location_code = p_location)),
    'recent', coalesce((select jsonb_agg(x order by x.doc_date desc, x.created_at desc) from (
        select d.id, d.doc_no, d.doc_type, d.doc_date, d.created_at, d.status, d.total, d.location_code,
          d.data ->> 'channel' as channel, d.data ->> 'supplier' as supplier, d.data ->> 'category' as category,
          d.data ->> 'materials' as materials, d.reverses_doc
        from public.documents d
        where d.doc_date between p_from and p_to
          and (p_location is null or d.location_code = p_location)
        order by d.doc_date desc, d.created_at desc
        limit 8) x), '[]'::jsonb)
  ) into r
  from t, f, e, pur, opening;
  return r;
end $$;

revoke all on function public.overview_report(date, date, text) from public, anon;
grant execute on function public.overview_report(date, date, text) to authenticated;
