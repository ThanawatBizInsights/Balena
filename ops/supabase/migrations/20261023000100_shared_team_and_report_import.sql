-- Shared team workflow and checked sales-report imports.
--
-- 1. Team: the app no longer shows business roles. New members join the shared workflow
--    (role 'partner': record everything, see all figures, flag records). The role column stays;
--    'owner' remains the technical administrator who manages membership, settings and
--    approvals. Nothing is dropped.
-- 2. Imports: a consignment sales report (e.g. ICONSIAM's monthly report) is imported as one
--    record with one line per source item. Every figure is checked against the report's own
--    totals before anything is saved; a mismatch stops the import for review. The report
--    number + branch + period (+ item code per line) make re-imports return the existing
--    record instead of duplicating sales, GP or stock.
-- 3. Stock: an imported report only deducts stock when stock at that location was already
--    recorded before the report period. Otherwise the sale is recorded with
--    stock = 'not_reconciled' and no stock movement, so nothing is deducted twice and no
--    opening stock is invented. Cost of goods for such lines is unknown, so no profit is shown.

alter table public.members alter column role set default 'partner';

alter table public.documents add column source_ref text;
alter table public.doc_lines add column source_key text;
comment on column public.documents.source_ref is 'Source document identity for imports: channel|report|branch|period. Unique among live records.';
comment on column public.doc_lines.source_key is 'Source line identity for imports: source_ref|item code.';
create unique index documents_source_ref_live on public.documents (source_ref)
  where source_ref is not null and status in ('pending', 'posted');
create index doc_lines_source_key on public.doc_lines (source_key) where source_key is not null;

create or replace function private.apply_effects(p_doc uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.documents;
  l record;
  ship numeric;
  sub numeric;
  in_cost numeric := 0;
  cost_known boolean := true;
  out_line record;
  c numeric;
  sys numeric;
begin
  select * into d from public.documents where id = p_doc;

  if d.doc_type = 'purchase' then
    ship := coalesce((d.data ->> 'shipping')::numeric, 0);
    select sum(amount) into sub from public.doc_lines where doc_id = d.id;
    for l in select * from public.doc_lines where doc_id = d.id order by line_no loop
      perform private.move(d.doc_date, l.item_id, d.location_code, l.qty, 'purchase', 'purchase', d.id,
        (l.amount + case when sub > 0 then ship * l.amount / sub else 0 end) / l.qty);
    end loop;
    perform private.pay_effect(d, d.total, 'purchase');

  elsif d.doc_type = 'expense' then
    perform private.pay_effect(d, d.total, 'expense');

  elsif d.doc_type = 'production' then
    for l in select * from public.doc_lines where doc_id = d.id and extra ->> 'dir' = 'in' order by line_no loop
      c := private.move(d.doc_date, l.item_id, d.location_code, -l.qty, 'production_in', 'production', d.id);
      if c is null then cost_known := false; else in_cost := in_cost + c * l.qty; end if;
    end loop;
    select * into out_line from public.doc_lines where doc_id = d.id and extra ->> 'dir' = 'out';
    perform private.move(d.doc_date, out_line.item_id, d.location_code, out_line.qty, 'production_out', 'production', d.id,
      case when cost_known then in_cost / out_line.qty end);
    if not cost_known then
      -- Output with unknown cost: still counted, cost stays unknown until inputs are costed.
      null;
    end if;

  elsif d.doc_type = 'transfer' then
    for l in select * from public.doc_lines where doc_id = d.id order by line_no loop
      perform private.move(d.doc_date, l.item_id, d.location_code, -l.qty, 'transfer_out', 'transfer', d.id);
      perform private.move(d.doc_date, l.item_id, 'TRANSIT', l.qty, 'in_transit', 'transfer', d.id);
    end loop;

  elsif d.doc_type = 'count' then
    for l in select * from public.doc_lines where doc_id = d.id order by line_no loop
      sys := public.on_hand(l.item_id, d.location_code);
      update public.doc_lines set extra = extra || jsonb_build_object('system_qty_at_posting', sys) where id = l.id;
      if l.qty - sys <> 0 then
        perform private.move(d.doc_date, l.item_id, d.location_code, l.qty - sys, 'count_adjust', 'count', d.id);
      end if;
    end loop;

  elsif d.doc_type = 'sale' then
    for l in select * from public.doc_lines where doc_id = d.id order by line_no loop
      perform private.move(d.doc_date, l.item_id, d.location_code, -l.qty, 'sale', 'sale', d.id);
    end loop;
    if d.data ->> 'paid' not in ('payout', 'unpaid') then
      perform private.money(d.doc_date, d.data ->> 'paid', d.total, 'sale', 'sale', d.id);
    end if;

  elsif d.doc_type = 'consignment' then
    -- Imported reports whose stock isn't reconciled yet (no stock recorded at the location before
    -- the report period) record the sale without touching stock, so nothing is deducted twice
    -- and no opening stock is invented.
    if coalesce(d.data ->> 'stock', 'deduct') <> 'not_reconciled' then
      for l in select * from public.doc_lines where doc_id = d.id order by line_no loop
        perform private.move(d.doc_date, l.item_id, d.location_code, -l.qty, 'sale', 'consignment', d.id);
      end loop;
    end if;

  elsif d.doc_type = 'payment' then
    if d.data ->> 'direction' = 'in' then
      perform private.money(d.doc_date, d.data ->> 'account', d.total, 'received', 'payment', d.id);
    else
      perform private.pay_effect(d, d.total, 'bill_paid');
    end if;

  elsif d.doc_type = 'partner' then
    if d.data ->> 'kind' = 'contribution' then
      perform private.money(d.doc_date, d.data ->> 'account', d.total, 'contribution', 'partner', d.id);
      perform private.partner(d.doc_date, (d.data ->> 'member')::uuid, d.total, 'contribution', 'partner', d.id);
    elsif d.data ->> 'kind' = 'drawing' then
      perform private.money(d.doc_date, d.data ->> 'account', -d.total, 'drawing', 'partner', d.id);
      perform private.partner(d.doc_date, (d.data ->> 'member')::uuid, -d.total, 'drawing', 'partner', d.id);
    else -- reimbursed
      perform private.money(d.doc_date, d.data ->> 'account', -d.total, 'reimbursed', 'partner', d.id);
      perform private.partner(d.doc_date, (d.data ->> 'member')::uuid, -d.total, 'reimbursed', 'partner', d.id);
    end if;

  elsif d.doc_type = 'opening' then
    for l in select * from public.doc_lines where doc_id = d.id order by line_no loop
      if l.extra ->> 'kind' = 'stock' then
        perform private.move(d.doc_date, l.item_id, l.extra ->> 'location', l.qty, 'opening', 'opening', d.id, l.unit_price);
      elsif l.extra ->> 'kind' = 'money' then
        perform private.money(d.doc_date, l.extra ->> 'account', l.amount, 'opening', 'opening', d.id);
      elsif l.extra ->> 'kind' = 'partner' then
        perform private.partner(d.doc_date, (l.extra ->> 'member')::uuid, l.amount, l.extra ->> 'partner_kind', 'opening', d.id);
      end if;
    end loop;
  end if;
end $$;

create or replace function public.import_sales_report(p jsonb) returns public.documents
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  me uuid := private.member_id();
  d public.documents;
  ch public.channels;
  loc text := p ->> 'location_code';
  ps date := (p ->> 'period_start')::date;
  pe date := (p ->> 'period_end')::date;
  gp numeric := (p ->> 'gp_percent')::numeric;
  lines jsonb := coalesce(p -> 'lines', '[]'::jsonb);
  tot jsonb := coalesce(p -> 'totals', '{}'::jsonb);
  ref text;
  l jsonb;
  i integer := 0;
  item uuid;
  q numeric; price numeric; gross numeric; disc numeric; net numeric; supp numeric;
  units numeric := 0; s_gross numeric := 0; s_disc numeric := 0; s_net numeric := 0; s_supp numeric := 0;
  bad jsonb := '[]'::jsonb;
  keys text[] := '{}';
  stock_ok boolean;
  needs boolean;
begin
  perform private.require(me is not null, 'not_member');
  select * into ch from public.channels where code = p ->> 'channel' and kind = 'consignment' and active;
  perform private.require(found, 'channel_required');
  perform private.require(exists (select 1 from public.locations where code = loc and kind = 'consignment' and active), 'consignment_location');
  perform private.require(coalesce(p ->> 'report_no', '') <> '' and coalesce(p ->> 'branch_code', '') <> '', 'report_no_required');
  perform private.require(ps is not null and pe is not null and pe >= ps, 'period_required');
  perform private.require(gp between 0 and 100, 'gp_required');
  perform private.require(jsonb_array_length(lines) > 0, 'lines_required');

  ref := concat_ws('|', ch.code, p ->> 'report_no', p ->> 'branch_code', ps, pe);
  -- Re-importing the same report returns the record already made.
  select * into d from public.documents where source_ref = ref and status in ('pending', 'posted');
  if found then return d; end if;
  perform private.assert_open(pe);

  -- Check every line against its own arithmetic, then the report totals.
  for l in select * from jsonb_array_elements(lines) loop
    q := (l ->> 'qty')::numeric; price := (l ->> 'unit_price')::numeric; gross := (l ->> 'sales_amount')::numeric;
    disc := coalesce((l ->> 'discount')::numeric, 0); net := (l ->> 'net_sales')::numeric; supp := (l ->> 'supplier_amount')::numeric;
    perform private.require(coalesce(l ->> 'item_code', '') <> '', 'item_code_required');
    perform private.require(q > 0 and price >= 0 and gross >= 0 and net >= 0 and supp >= 0, 'report_line_incomplete', jsonb_build_object('item_code', l ->> 'item_code'));
    if round(q * price, 2) <> gross or gross - disc <> net or round(net * (1 - gp / 100), 2) <> supp then
      bad := bad || jsonb_build_object('item_code', l ->> 'item_code', 'qty', q, 'unit_price', price, 'sales_amount', gross,
        'net_sales', net, 'supplier_amount', supp, 'expected_supplier_amount', round(net * (1 - gp / 100), 2));
    end if;
    perform private.require(not (ref || '|' || (l ->> 'item_code')) = any(keys), 'duplicate_line', jsonb_build_object('item_code', l ->> 'item_code'));
    keys := keys || (ref || '|' || (l ->> 'item_code'));
    units := units + q; s_gross := s_gross + gross; s_disc := s_disc + disc; s_net := s_net + net; s_supp := s_supp + supp;
  end loop;
  if jsonb_array_length(bad) > 0 then perform private.fail('report_mismatch', jsonb_build_object('lines', bad)); end if;
  if units <> (tot ->> 'units')::numeric or s_net <> (tot ->> 'net_sales')::numeric
     or s_supp <> (tot ->> 'supplier_amount')::numeric or s_net - s_supp <> (tot ->> 'gp_amount')::numeric
     or (tot ->> 'vat_amount') is null then
    perform private.fail('report_totals_mismatch', jsonb_build_object(
      'units', units, 'net_sales', s_net, 'gp_amount', s_net - s_supp, 'supplier_amount', s_supp, 'report', tot));
  end if;
  perform private.require(not exists (select 1 from public.doc_lines x join public.documents y on y.id = x.doc_id
    where x.source_key = any(keys) and y.status in ('pending', 'posted')), 'duplicate_report', jsonb_build_object('report_no', p ->> 'report_no'));

  stock_ok := exists (select 1 from public.stock_moves where location_code = loc and move_date < ps);
  needs := coalesce(private.member_role(), '') <> 'owner';

  insert into public.documents (doc_no, doc_type, doc_date, location_code, status, total, data, note, needs_approval,
    approved_by, approved_at, source_ref, client_key, created_by)
  values (private.next_doc_no('consignment', pe), 'consignment', pe, loc, case when needs then 'pending' else 'posted' end, s_net,
    jsonb_build_object(
      'channel', ch.code, 'report_no', p ->> 'report_no',
      'branch_code', p ->> 'branch_code', 'branch_name', p ->> 'branch_name',
      'period_start', ps, 'period_end', pe, 'generated_at', p ->> 'generated_at',
      'gp_percent', gp, 'units', units, 'sales_amount', s_gross, 'discount_total', s_disc,
      'gp_amount', s_net - s_supp, 'amount_due', s_supp, 'vat_amount', (tot ->> 'vat_amount')::numeric,
      'receipt_status', 'unconfirmed',
      'stock', case when stock_ok then 'deduct' else 'not_reconciled' end,
      'cost', 'unavailable',
      'import', jsonb_build_object('source', p -> 'source', 'method', p ->> 'method', 'imported_at', now())),
    nullif(p ->> 'note', ''), needs, case when not needs then me end, case when not needs then now() end,
    ref, gen_random_uuid(), me)
  returning * into d;

  for l in select * from jsonb_array_elements(lines) loop
    i := i + 1;
    select id into item from public.stock_items where iconsiam_code = l ->> 'item_code';
    if item is null then
      -- Unknown item: keep it as an identifiable historical product instead of guessing a match.
      insert into public.stock_items (code, name_en, name_th, kind, base_unit, category, size_confirmed, iconsiam_code, barcode, active)
      values ('LEGACY-' || ch.code || '-' || (l ->> 'item_code'), l ->> 'description', l ->> 'description', 'product', 'pc', 'other',
        false, l ->> 'item_code', nullif(l ->> 'barcode', ''), false)
      returning id into item;
    end if;
    insert into public.doc_lines (doc_id, line_no, item_id, qty, unit_price, amount, extra, source_key)
    values (d.id, i, item, (l ->> 'qty')::numeric, (l ->> 'unit_price')::numeric, (l ->> 'net_sales')::numeric,
      jsonb_build_object('item_code', l ->> 'item_code', 'barcode', l ->> 'barcode', 'source_name', l ->> 'description',
        'sales_amount', (l ->> 'sales_amount')::numeric, 'discount', coalesce((l ->> 'discount')::numeric, 0),
        'supplier_amount', (l ->> 'supplier_amount')::numeric,
        'gp_amount', (l ->> 'net_sales')::numeric - (l ->> 'supplier_amount')::numeric),
      ref || '|' || (l ->> 'item_code'));
  end loop;

  if d.status = 'posted' then perform private.apply_effects(d.id); end if;
  perform private.log('import', 'documents', d.id::text, 'Sales report ' || (p ->> 'report_no'), d.data -> 'import');
  return d;
end $$;

revoke all on function public.import_sales_report(jsonb) from public, anon;
grant execute on function public.import_sales_report(jsonb) to authenticated;
revoke all on function private.apply_effects(uuid) from public, anon, authenticated;
