-- One reporting function for the Overview and the Business Report.
--
-- Scope: posted sales records (shop/online sales and consignment reports) dated in the range,
-- excluding reversals (a reversed record and its reversal cancel out). Imported reports are
-- dated at the end of their sales period, so a monthly report counts in that month.
-- Every measure says whether it is complete; profit is only returned when every sale line has
-- a known cost, every channel fee is known, and no channel filter is applied (expenses aren't
-- per channel). Cash balance is only returned once an opening balance has been posted. Security invoker: the caller's access rules apply.

create or replace function public.business_report(p_from date, p_to date, p_channel text default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  r jsonb;
begin
  with docs as (
    select d.* from public.documents d
    where d.status = 'posted' and d.reverses_doc is null and d.doc_type in ('sale', 'consignment')
      and d.doc_date between p_from and p_to
      and (p_channel is null or d.data ->> 'channel' = p_channel)
  ),
  lines as (
    select l.*, d.doc_type, d.doc_date, d.data ->> 'channel' as channel,
      coalesce((l.extra ->> 'sales_amount')::numeric, round(l.qty * l.unit_price, 2)) as gross,
      coalesce((l.extra ->> 'discount')::numeric, 0) as discount,
      (select -sum(m.value) from public.stock_moves m
        where m.doc_id = l.doc_id and m.item_id = l.item_id and m.kind = 'sale' and m.unit_cost is not null) as cogs
    from public.doc_lines l join docs d on d.id = l.doc_id
  ),
  recv as (
    select r.* from public.receivables r join docs d on d.id = r.id
  ),
  pay_in as (
    select p.* from public.documents p
    where p.doc_type = 'payment' and p.status = 'posted' and p.reverses_doc is null and p.data ->> 'direction' = 'in'
      and p.doc_date between p_from and p_to
  ),
  exp as (
    select d.* from public.documents d
    where d.doc_type = 'expense' and d.status = 'posted' and d.reverses_doc is null and d.doc_date between p_from and p_to
  ),
  returned as (
    select d.* from public.documents d
    where d.status = 'reversed' and d.doc_type in ('sale', 'consignment') and d.doc_date between p_from and p_to
      and (p_channel is null or d.data ->> 'channel' = p_channel)
  ),
  t as (
    select
      coalesce(sum(qty), 0) as units, coalesce(sum(gross), 0) as gross, coalesce(sum(discount), 0) as discounts,
      coalesce(sum(amount), 0) as net, count(*) filter (where cogs is null) as cogs_unknown,
      coalesce(sum(cogs), 0) as cogs_known, count(*) as line_count
    from lines
  ),
  f as (
    select
      coalesce((select sum((data ->> 'gp_amount')::numeric) from docs where doc_type = 'consignment'), 0) as gp,
      coalesce((select sum(settlement_fee) from recv where doc_type = 'sale'), 0) as settled_fees,
      (select count(*) from recv where doc_type = 'sale' and open_amount > 0) as fees_unknown
  ),
  rc as (
    select coalesce(sum(amount_due), 0) as expected, coalesce(sum(received), 0) as received,
      coalesce(sum(open_amount), 0) as open, count(*) filter (where received = 0 and open_amount > 0) as unconfirmed,
      coalesce(sum(open_amount) filter (where received = 0 and open_amount > 0), 0) as unconfirmed_amount
    from recv
  ),
  e as (
    select coalesce(sum(total) filter (where data ->> 'category' <> 'advertising'), 0) as opex,
      coalesce(sum(total) filter (where data ->> 'category' = 'advertising'), 0) as ads
    from exp
  ),
  opening as (
    select exists (select 1 from public.documents where doc_type = 'opening' and status = 'posted') as posted
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'channel', p_channel,
    'has_records', (select line_count from t) > 0,
    'units', t.units, 'gross_sales', t.gross, 'discounts', t.discounts, 'net_sales', t.net,
    'returns', jsonb_build_object('count', (select count(*) from returned), 'amount', coalesce((select sum(total) from returned), 0)),
    'gp', f.gp, 'settled_fees', f.settled_fees, 'fees_unknown_orders', f.fees_unknown,
    'fees_complete', f.fees_unknown = 0,
    'after_channel', t.net - f.gp - f.settled_fees,
    'receivable', jsonb_build_object('expected', rc.expected, 'received', rc.received, 'open', rc.open,
      'unconfirmed_count', rc.unconfirmed, 'unconfirmed_amount', rc.unconfirmed_amount),
    'cash_received', coalesce((select sum(total) from pay_in), 0),
    'cogs', case when t.cogs_unknown = 0 then t.cogs_known end,
    'cogs_known_part', t.cogs_known, 'cogs_unknown_lines', t.cogs_unknown, 'cogs_complete', t.cogs_unknown = 0,
    'expenses', e.opex, 'advertising', e.ads,
    'profit', case when t.cogs_unknown = 0 and f.fees_unknown = 0 and p_channel is null
      then t.net - f.gp - f.settled_fees - t.cogs_known - e.opex - e.ads end,
    'profit_missing', to_jsonb(array_remove(array[
      case when t.cogs_unknown > 0 then 'costs' end,
      case when f.fees_unknown > 0 then 'fees' end,
      case when p_channel is not null then 'channel_filter' end], null)),
    'opening_posted', opening.posted,
    'cash_balance', case when opening.posted then (select coalesce(sum(balance), 0) from public.account_balances) end,
    'stock_unreconciled', (select count(*) from docs where data ->> 'stock' = 'not_reconciled'),
    'pending_approvals', (select count(*) from public.documents where status = 'pending'),
    'low_stock', (select count(*) from public.stock_on_hand where min_level is not null and qty < min_level),
    'latest_sales_date', (select max(doc_date) from public.documents
      where status = 'posted' and reverses_doc is null and doc_type in ('sale', 'consignment')),
    'by_channel', coalesce((select jsonb_agg(x order by x.net desc) from (
        select channel, sum(qty) as units, sum(amount) as net from lines group by channel) x), '[]'::jsonb),
    'by_product', coalesce((select jsonb_agg(x order by x.net desc) from (
        select l.item_id, i.name_th, i.name_en, sum(l.qty) as units, sum(l.amount) as net
        from lines l left join public.stock_items i on i.id = l.item_id group by l.item_id, i.name_th, i.name_en) x), '[]'::jsonb),
    'by_month', coalesce((select jsonb_agg(x order by x.month) from (
        select to_char(doc_date, 'YYYY-MM') as month, sum(qty) as units, sum(amount) as net from lines group by 1) x), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(x order by x.doc_date desc, x.doc_no) from (
        select d.id, d.doc_no, d.doc_type, d.doc_date, d.data ->> 'channel' as channel, d.data ->> 'report_no' as report_no,
          d.data ->> 'branch_name' as branch_name, d.data ->> 'period_start' as period_start, d.data ->> 'period_end' as period_end,
          d.data ->> 'generated_at' as generated_at, d.data -> 'import' -> 'source' as source, d.data ->> 'stock' as stock,
          d.total as net_sales, (d.data ->> 'gp_amount')::numeric as gp, r.amount_due, r.received, r.open_amount,
          case when r.id is null then 'paid_at_sale' when r.open_amount = 0 then 'settled'
               when r.received > 0 then 'partly_received' else 'unconfirmed' end as receipt_status,
          (select sum(qty) from lines where doc_id = d.id) as units
        from docs d left join recv r on r.id = d.id) x), '[]'::jsonb)
  ) into r
  from t, f, rc, e, opening;
  return r;
end $$;

revoke all on function public.business_report(date, date, text) from public, anon;
grant execute on function public.business_report(date, date, text) to authenticated;
