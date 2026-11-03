-- Historical official reports (sales only, no inventory effect) and stock baselines.
--
-- 1. sales_updates.inventory_effect: 'ledger' (default) reconciles stock as before; 'none' marks a
--    historical sales-only report. A month with an active 'none' final never touches stock, whatever
--    is imported into it later (revisions inherit 'none').
-- 2. Official reports may carry signed rows (sales and returns) and repeated item codes: every
--    printed row keeps its own identity on the report document (doc_lines.source_key = ref|row).
--    The sales layer keeps one net line per product, plus one unallocated line for rows without a
--    product (e.g. "BALENA ROASTERY-Event"), item_id null until allocated through a revision.
-- 3. stock_baselines: an actual count by SKU and location, with effective date and time, who
--    counted, who recorded and whether it is confirmed. Only a confirmed baseline posts a count.

alter table public.sales_updates add column if not exists inventory_effect text not null default 'ledger';
alter table public.sales_updates add constraint sales_updates_inventory_effect_check check (inventory_effect in ('ledger', 'none'));

alter table public.sales_update_lines alter column item_id drop not null;
alter table public.sales_update_lines
  add column if not exists returns_qty numeric(14,3) not null default 0,
  add column if not exists returns_net numeric(14,2) not null default 0,
  add column if not exists source_rows integer not null default 1;

create table public.stock_baselines (
  id uuid primary key default gen_random_uuid(),
  location_code text not null references public.locations (code),
  effective_at timestamptz not null,
  counted_by text not null check (btrim(counted_by) <> ''),
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'cancelled')),
  note text,
  count_doc uuid references public.documents (id),
  client_key uuid unique,
  recorded_by uuid not null references public.members (id),
  recorded_at timestamptz not null default now(),
  confirmed_by uuid references public.members (id),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.stock_baseline_lines (
  baseline_id uuid not null references public.stock_baselines (id),
  item_id uuid not null references public.stock_items (id),
  qty numeric(14,3) not null check (qty >= 0),
  primary key (baseline_id, item_id)
);
alter table public.stock_baselines enable row level security;
alter table public.stock_baseline_lines enable row level security;
revoke all on public.stock_baselines, public.stock_baseline_lines from anon, authenticated;
grant select on public.stock_baselines, public.stock_baseline_lines to authenticated;
create policy read on public.stock_baselines for select to authenticated using (private.is_member());
create policy read on public.stock_baseline_lines for select to authenticated using (private.is_member());
create trigger audit after insert or update or delete on public.stock_baselines for each row execute function private.audit();
create trigger audit after insert or update or delete on public.stock_baseline_lines for each row execute function private.audit();

-- ---------- official report import: row identity, signed returns, explicit products ----------
-- With p.row_identity = true every line carries `row` (its position on the printed report) and
-- `type` ('S' sale, 'R' return). Repeated item codes are separate rows. Returns keep the signs
-- printed on the report (negative quantity, price and amounts) and are checked as
-- qty × |price| = sales amount. A line names its product with item_id, or allocation = 'pending'
-- (kept without a product). p.inventory_effect = 'none' records sales only: no stock effects, ever.
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
  rows_mode boolean := coalesce((p ->> 'row_identity')::boolean, false);
  historical boolean := coalesce(p ->> 'inventory_effect', '') = 'none';
  ref text;
  l jsonb;
  i integer := 0;
  item uuid;
  typ text;
  key text;
  q numeric; price numeric; gross numeric; disc numeric; net numeric; supp numeric;
  units numeric := 0; s_gross numeric := 0; s_disc numeric := 0; s_net numeric := 0; s_supp numeric := 0;
  sales_gross numeric := 0; ret_net numeric := 0; ret_units numeric := 0; unalloc numeric := 0;
  bad jsonb := '[]'::jsonb;
  keys text[] := '{}';
  stock_ok boolean;
  by_layer boolean := coalesce((p ->> 'stock_by_layer')::boolean, false) or historical;
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

  -- A revised report (same number and period, reissued) gets its own identity: '|r2', '|r3'...
  ref := concat_ws('|', ch.code, p ->> 'report_no', p ->> 'branch_code', ps, pe, nullif(p ->> 'revision', ''));
  -- Re-importing the same report returns the record already made.
  select * into d from public.documents where source_ref = ref and status in ('pending', 'posted');
  if found then return d; end if;
  perform private.assert_open(pe);

  -- Check every line against its own arithmetic, then the report totals.
  for l in select * from jsonb_array_elements(lines) loop
    q := (l ->> 'qty')::numeric; price := (l ->> 'unit_price')::numeric; gross := (l ->> 'sales_amount')::numeric;
    disc := coalesce((l ->> 'discount')::numeric, 0); net := (l ->> 'net_sales')::numeric; supp := (l ->> 'supplier_amount')::numeric;
    typ := case when rows_mode then coalesce(l ->> 'type', 'S') else 'S' end;
    perform private.require(coalesce(l ->> 'item_code', '') <> '', 'item_code_required');
    perform private.require(typ in ('S', 'R'), 'report_line_incomplete', jsonb_build_object('item_code', l ->> 'item_code'));
    if typ = 'S' then
      perform private.require(q > 0 and price >= 0 and gross >= 0 and net >= 0 and supp >= 0, 'report_line_incomplete', jsonb_build_object('item_code', l ->> 'item_code'));
    else
      -- Returns as printed: negative quantity, price and amounts.
      perform private.require(q < 0 and price <= 0 and gross <= 0 and net <= 0 and supp <= 0, 'report_line_incomplete', jsonb_build_object('item_code', l ->> 'item_code'));
    end if;
    if round(q * abs(price), 2) <> gross or gross - disc <> net or round(net * (1 - gp / 100), 2) <> supp then
      bad := bad || jsonb_build_object('item_code', l ->> 'item_code', 'row', l -> 'row', 'qty', q, 'unit_price', price, 'sales_amount', gross,
        'net_sales', net, 'supplier_amount', supp, 'expected_supplier_amount', round(net * (1 - gp / 100), 2));
    end if;
    if rows_mode then
      perform private.require((l ->> 'row') ~ '^[0-9]+$', 'report_line_incomplete', jsonb_build_object('item_code', l ->> 'item_code'));
      key := ref || '|row' || (l ->> 'row');
    else
      key := ref || '|' || (l ->> 'item_code');
    end if;
    perform private.require(not key = any(keys), 'duplicate_line', jsonb_build_object('item_code', l ->> 'item_code'));
    keys := keys || key;
    if nullif(l ->> 'item_id', '') is not null then
      perform private.require(private.item_kind((l ->> 'item_id')::uuid) = 'product', 'unknown_item');
    end if;
    units := units + q; s_gross := s_gross + gross; s_disc := s_disc + disc; s_net := s_net + net; s_supp := s_supp + supp;
    if typ = 'S' then sales_gross := sales_gross + gross; else ret_net := ret_net + net; ret_units := ret_units + q; end if;
    if coalesce(l ->> 'allocation', '') = 'pending' then unalloc := unalloc + net; end if;
  end loop;
  if jsonb_array_length(bad) > 0 then perform private.fail('report_mismatch', jsonb_build_object('lines', bad)); end if;
  if units <> (tot ->> 'units')::numeric or s_net <> (tot ->> 'net_sales')::numeric
     or s_supp <> (tot ->> 'supplier_amount')::numeric or s_net - s_supp <> (tot ->> 'gp_amount')::numeric
     or (tot ->> 'vat_amount') is null
     or (tot ? 'sales_before_returns' and sales_gross <> (tot ->> 'sales_before_returns')::numeric)
     or (tot ? 'returns' and ret_net <> (tot ->> 'returns')::numeric) then
    perform private.fail('report_totals_mismatch', jsonb_build_object(
      'units', units, 'net_sales', s_net, 'gp_amount', s_net - s_supp, 'supplier_amount', s_supp,
      'sales_before_returns', sales_gross, 'returns', ret_net, 'report', tot));
  end if;
  perform private.require(not exists (select 1 from public.doc_lines x join public.documents y on y.id = x.doc_id
    where x.source_key = any(keys) and y.status in ('pending', 'posted')), 'duplicate_report', jsonb_build_object('report_no', p ->> 'report_no'));

  stock_ok := not by_layer and exists (select 1 from public.stock_moves where location_code = loc and move_date < ps);
  needs := coalesce(private.member_role(), '') <> 'owner';

  insert into public.documents (doc_no, doc_type, doc_date, location_code, status, total, data, note, needs_approval,
    approved_by, approved_at, source_ref, client_key, created_by)
  values (private.next_doc_no('consignment', pe), 'consignment', pe, loc, case when needs then 'pending' else 'posted' end, s_net,
    jsonb_build_object(
      'channel', ch.code, 'report_no', p ->> 'report_no',
      'branch_code', p ->> 'branch_code', 'branch_name', p ->> 'branch_name',
      'period_code', p ->> 'period_code',
      'period_start', ps, 'period_end', pe, 'generated_at', p ->> 'generated_at',
      'gp_percent', gp, 'units', units, 'sales_amount', s_gross, 'discount_total', s_disc,
      'sales_before_returns', sales_gross, 'returns_amount', ret_net, 'returns_units', ret_units,
      'unallocated_net', unalloc,
      'gp_amount', s_net - s_supp, 'amount_due', s_supp, 'vat_amount', (tot ->> 'vat_amount')::numeric,
      'receipt_status', 'unconfirmed',
      'inventory_effect', case when historical then 'none' else 'ledger' end,
      'stock', case when historical then 'historical' when by_layer then 'layer' when stock_ok then 'deduct' else 'not_reconciled' end,
      'cost', 'unavailable',
      'import', jsonb_build_object('source', p -> 'source', 'method', p ->> 'method', 'imported_at', now())),
    nullif(p ->> 'note', ''), needs, case when not needs then me end, case when not needs then now() end,
    ref, gen_random_uuid(), me)
  returning * into d;

  for l in select * from jsonb_array_elements(lines) loop
    i := i + 1;
    if nullif(l ->> 'item_id', '') is not null then
      item := (l ->> 'item_id')::uuid;
    elsif coalesce(l ->> 'allocation', '') = 'pending' then
      item := null;
    else
      select id into item from public.stock_items where iconsiam_code = l ->> 'item_code';
      if item is null then
        insert into public.stock_items (code, name_en, name_th, kind, base_unit, category, category_code, size_confirmed, iconsiam_code, barcode, active)
        values ('LEGACY-' || ch.code || '-' || (l ->> 'item_code'), l ->> 'description', l ->> 'description', 'product', 'pc', 'other', 'FIN',
          false, l ->> 'item_code', nullif(l ->> 'barcode', ''), false)
        returning id into item;
      end if;
    end if;
    insert into public.doc_lines (doc_id, line_no, item_id, qty, unit_price, amount, extra, source_key)
    values (d.id, i, item, (l ->> 'qty')::numeric, (l ->> 'unit_price')::numeric, (l ->> 'net_sales')::numeric,
      jsonb_build_object('item_code', l ->> 'item_code', 'barcode', l ->> 'barcode', 'source_name', l ->> 'description',
        'type', case when rows_mode then coalesce(l ->> 'type', 'S') else 'S' end, 'row', l -> 'row',
        'allocation', case when item is null then 'pending' end, 'mapping', l -> 'mapping',
        'sales_amount', (l ->> 'sales_amount')::numeric, 'discount', coalesce((l ->> 'discount')::numeric, 0),
        'supplier_amount', (l ->> 'supplier_amount')::numeric,
        'gp_amount', (l ->> 'net_sales')::numeric - (l ->> 'supplier_amount')::numeric),
      case when rows_mode then ref || '|row' || (l ->> 'row') else ref || '|' || (l ->> 'item_code') end);
  end loop;

  if d.status = 'posted' and not by_layer then perform private.apply_effects(d.id); end if;
  perform private.log('import', 'documents', d.id::text, 'Sales report ' || (p ->> 'report_no'), d.data -> 'import');
  return d;
end $$;

-- A consignment report moves stock only when it was recorded to deduct ('deduct', or legacy rows
-- without a flag). 'layer' (sales layer reconciles), 'historical' (sales only) and 'not_reconciled'
-- never move stock, including when a pending report is approved later.
do $$
declare
  def text := pg_get_functiondef('private.apply_effects(uuid)'::regprocedure);
  old_cond constant text := 'if coalesce(d.data ->> ''stock'', ''deduct'') <> ''not_reconciled'' then';
  new_cond constant text := 'if coalesce(d.data ->> ''stock'', ''deduct'') = ''deduct'' then';
begin
  if position(new_cond in def) > 0 then return; end if;
  if position(old_cond in def) = 0 then raise exception 'consignment stock condition not found in apply_effects'; end if;
  execute replace(def, old_cond, new_cond);
end $$;

-- ---------- commit: historical finals, net lines per product, superseded interims ----------
create or replace function public.commit_sales_update(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  me uuid := private.member_id();
  ch text := coalesce(nullif(p ->> 'channel', ''), 'ICONSIAM');
  loc text := coalesce(nullif(p ->> 'location_code', ''), 'ICS');
  k text := p ->> 'kind';
  rep jsonb := p -> 'report';
  cs date := (p ->> 'coverage_start')::date;
  ce date := (p ->> 'coverage_end')::date;
  ao date := (p ->> 'as_of')::date;
  eff text := case when p ->> 'inventory_effect' = 'none' then 'none' else 'ledger' end;
  mo date;
  ref text;
  lines jsonb := coalesce(p -> 'lines', '[]'::jsonb);
  u public.sales_updates;
  prev public.sales_updates;
  doc public.documents;
  h text;
  l jsonb;
  i integer := 0;
  ver integer := 1;
  stock jsonb;
  rid uuid;
  replaced integer := 0;
begin
  ref := nullif(btrim(p ->> 'source_ref'), '');
  perform private.require(me is not null, 'not_member');
  perform private.require(private.sees_money(), 'not_allowed');
  perform private.require(k in ('interval', 'snapshot', 'final'), 'update_kind');
  -- Sales-only (no inventory effect) is a property of official monthly reports.
  perform private.require(eff = 'ledger' or k = 'final', 'update_kind');
  perform private.require(exists (select 1 from public.channels where code = ch and kind = 'consignment' and active), 'channel_required');
  perform private.require(exists (select 1 from public.locations where code = loc and kind = 'consignment' and active), 'consignment_location');

  if k = 'final' then
    perform private.require(private.is_owner(), 'owner_only');
    perform private.require(rep is not null, 'lines_required');
    cs := (rep ->> 'period_start')::date;
    ce := (rep ->> 'period_end')::date;
    ao := greatest(coalesce((rep ->> 'generated_at')::date, ce), ce);
    h := md5(jsonb_build_object('lines', rep -> 'lines', 'totals', rep -> 'totals', 'gp', rep -> 'gp_percent')::text);
  else
    perform private.require(ref is not null, 'source_ref_required');
    perform private.require(jsonb_array_length(lines) > 0, 'lines_required');
    ao := coalesce(ao, ce);
  end if;
  perform private.require(cs is not null and ce is not null and ce >= cs, 'period_required');
  mo := date_trunc('month', cs)::date;
  perform private.require(date_trunc('month', ce)::date = mo, 'period_one_month');
  perform private.require(ao >= ce, 'as_of_before_coverage');
  if k = 'snapshot' then
    perform private.require(cs = mo and ce = ao, 'snapshot_from_month_start');
  end if;

  if k <> 'final' then
    for l in select * from jsonb_array_elements(lines) loop
      perform private.require(private.item_kind(nullif(l ->> 'item_id', '')::uuid) = 'product', 'unknown_item', jsonb_build_object('line', l));
      perform private.require(coalesce((l ->> 'qty')::numeric, -1) >= 0, 'qty_positive', jsonb_build_object('line', l));
      perform private.require(coalesce((l ->> 'net')::numeric, 0) >= 0, 'amount_required', jsonb_build_object('line', l));
    end loop;
    h := md5(jsonb_build_object('k', k, 'cs', cs, 'ce', ce, 'ao', ao, 'lines', (select jsonb_agg(jsonb_build_object(
      'item', x ->> 'item_id', 'qty', (x ->> 'qty')::numeric, 'net', (x ->> 'net')::numeric) order by x ->> 'item_id')
      from jsonb_array_elements(lines) x))::text);
  end if;

  -- The same source again changes nothing.
  if k = 'final' then
    select * into u from public.sales_updates where channel_code = ch and location_code = loc and kind = 'final'
      and coverage_start = cs and coverage_end = ce and (content_hash = h or source_ref = concat_ws('|', ch, rep ->> 'report_no', rep ->> 'branch_code', cs, ce))
      order by version desc limit 1;
    if found and (u.content_hash = h or u.content_hash like 'legacy:%') then
      return jsonb_build_object('update', to_jsonb(u), 'unchanged', true, 'stock', '[]'::jsonb);
    end if;
  else
    select * into u from public.sales_updates where source_ref = ref;
    if found then
      perform private.require(u.content_hash = h, 'source_changed', jsonb_build_object('source_ref', ref));
      return jsonb_build_object('update', to_jsonb(u), 'unchanged', true, 'stock', '[]'::jsonb);
    end if;
  end if;

  if k = 'interval' then
    for rid in select (jsonb_array_elements_text(coalesce(p -> 'replaces', '[]'::jsonb)))::uuid loop
      update public.sales_updates set status = 'superseded'
      where id = rid and channel_code = ch and location_code = loc and month = mo and kind = 'interval' and status = 'active';
      perform private.require(found, 'not_replaceable', jsonb_build_object('update', rid));
    end loop;
    perform private.require(not exists (
      select 1 from public.sales_updates o join public.sales_update_lines ol on ol.update_id = o.id
      where o.channel_code = ch and o.location_code = loc and o.kind = 'interval' and o.status = 'active'
        and o.coverage_start <= ce and o.coverage_end >= cs
        and ol.item_id in (select (x ->> 'item_id')::uuid from jsonb_array_elements(lines) x)),
      'overlap_conflict');
  end if;

  if k = 'final' then
    select * into prev from public.sales_updates
    where channel_code = ch and location_code = loc and month = mo and kind = 'final' and status = 'active'
      and coverage_start <= ce and coverage_end >= cs
    order by version desc limit 1;
    if found then
      perform private.require(coalesce(p ->> 'revision_of', '') = prev.id::text, 'final_exists',
        jsonb_build_object('update', prev.id, 'version', prev.version));
      perform private.require(prev.coverage_start = cs and prev.coverage_end = ce, 'revision_coverage');
      ver := prev.version + 1;
      -- A revision of a sales-only report stays sales-only.
      if prev.inventory_effect = 'none' then eff := 'none'; end if;
    end if;
    doc := public.import_sales_report(rep || jsonb_build_object('stock_by_layer', true, 'channel', ch, 'location_code', loc,
      'inventory_effect', eff, 'revision', case when ver > 1 then 'r' || ver end));
    perform private.require(doc.status = 'posted', 'not_posted');
    perform private.require(not exists (select 1 from public.sales_updates where doc_id = doc.id), 'duplicate_report');
    ref := doc.source_ref;
    insert into public.sales_updates (channel_code, location_code, month, kind, coverage_start, coverage_end, as_of, version,
      source_ref, content_hash, source, doc_id, gp_percent, totals, inventory_effect, created_by)
    values (ch, loc, mo, 'final', cs, ce, ao, ver, ref, h,
      coalesce(p -> 'source', '{}'::jsonb) || jsonb_build_object('type', 'official_report', 'report_no', rep ->> 'report_no',
        'branch_code', rep ->> 'branch_code', 'branch_name', rep ->> 'branch_name', 'period_code', rep ->> 'period_code',
        'generated_at', rep ->> 'generated_at'),
      doc.id, (doc.data ->> 'gp_percent')::numeric,
      jsonb_build_object('units', doc.data -> 'units', 'gross', doc.data -> 'sales_amount', 'discount', doc.data -> 'discount_total',
        'net', doc.total, 'gp', doc.data -> 'gp_amount', 'payable', doc.data -> 'amount_due',
        'sales_before_returns', doc.data -> 'sales_before_returns', 'returns', doc.data -> 'returns_amount',
        'returns_units', doc.data -> 'returns_units', 'unallocated_net', doc.data -> 'unallocated_net'),
      eff, me)
    returning * into u;
    -- One net line per product (repeated rows and returns added up); rows without a product stay
    -- together on one unallocated line. Every printed row remains on the report document.
    insert into public.sales_update_lines (update_id, line_no, item_id, source_code, barcode, description, qty, unit_price, gross,
      discount, net, gp_amount, payable, returns_qty, returns_net, source_rows)
    select u.id, row_number() over (order by min(dl.line_no)), dl.item_id,
      string_agg(distinct dl.extra ->> 'item_code', ', '), string_agg(distinct dl.extra ->> 'barcode', ', '),
      min(dl.extra ->> 'source_name'), sum(dl.qty),
      case when count(distinct dl.unit_price) filter (where dl.qty > 0) = 1 then max(dl.unit_price) filter (where dl.qty > 0) end,
      sum((dl.extra ->> 'sales_amount')::numeric), sum(coalesce((dl.extra ->> 'discount')::numeric, 0)), sum(dl.amount),
      sum((dl.extra ->> 'gp_amount')::numeric), sum((dl.extra ->> 'supplier_amount')::numeric),
      coalesce(-sum(dl.qty) filter (where dl.extra ->> 'type' = 'R'), 0), coalesce(sum(dl.amount) filter (where dl.extra ->> 'type' = 'R'), 0),
      count(*)
    from public.doc_lines dl where dl.doc_id = doc.id
    group by dl.item_id;
    if prev.id is not null then
      update public.sales_updates set status = 'superseded', superseded_by = u.id where id = prev.id;
      update public.documents set status = 'superseded', data = data || jsonb_build_object('superseded_by', doc.id)
      where id = prev.doc_id;
      perform private.log('supersede', 'documents', prev.doc_id::text, 'Revised report v' || ver);
    end if;
    -- Interim figures inside the report's period are replaced, never added: kept for audit.
    update public.sales_updates set status = 'superseded', superseded_by = u.id
    where channel_code = ch and location_code = loc and month = mo and kind in ('interval', 'snapshot') and status = 'active'
      and coverage_start >= cs and coverage_end <= ce;
    get diagnostics replaced = row_count;
  else
    insert into public.sales_updates (channel_code, location_code, month, kind, coverage_start, coverage_end, as_of,
      source_ref, content_hash, source, gp_percent, totals, created_by)
    values (ch, loc, mo, k, cs, ce, ao, ref, h, coalesce(p -> 'source', '{}'::jsonb), nullif(p ->> 'gp_percent', '')::numeric,
      jsonb_build_object('units', (select sum((x ->> 'qty')::numeric) from jsonb_array_elements(lines) x),
        'net', (select sum((x ->> 'net')::numeric) from jsonb_array_elements(lines) x)), me)
    returning * into u;
    for l in select * from jsonb_array_elements(lines) loop
      i := i + 1;
      insert into public.sales_update_lines (update_id, line_no, item_id, source_code, barcode, description, qty, unit_price, gross, discount, net)
      values (u.id, i, (l ->> 'item_id')::uuid, nullif(l ->> 'source_code', ''), nullif(l ->> 'barcode', ''), nullif(l ->> 'description', ''),
        (l ->> 'qty')::numeric, nullif(l ->> 'unit_price', '')::numeric, nullif(l ->> 'gross', '')::numeric,
        nullif(l ->> 'discount', '')::numeric, nullif(l ->> 'net', '')::numeric);
    end loop;
  end if;

  if eff = 'none' then
    -- Historical sales only: stock is never touched, here or by later updates to this month.
    stock := '[]'::jsonb;
    perform private.log('sales_update', 'sales_updates', u.id::text, k || ' ' || ref || ' (historical sales only, no inventory effect)',
      jsonb_build_object('inventory_effect', 'none', 'replaced_interim', replaced));
  else
    stock := private.reconcile_sales_stock(ch, loc, mo, u.id);
    perform private.log('sales_update', 'sales_updates', u.id::text, k || ' ' || ref, jsonb_build_object('stock', stock, 'replaced_interim', replaced));
  end if;
  return jsonb_build_object('update', to_jsonb(u), 'unchanged', false, 'stock', stock, 'replaced_interim', replaced,
    'inventory_effect', eff);
end $$;

-- ---------- stock reconciliation: historical months, baselines ----------
-- A month with an active sales-only official report never moves stock. Rows without a product are
-- skipped. A confirmed stock baseline (a count with data.baseline = true) dated inside an update's
-- period, with nothing reconciled for that product up to the baseline, means the sales before the
-- count can't be separated from those after it: nothing is deducted and the row is flagged
-- 'spans_baseline' for review, instead of deducting the whole period from the counted balance.
create or replace function private.reconcile_sales_stock(p_channel text, p_loc text, p_month date, p_update uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  e record;
  st public.sales_stock_state;
  diff numeric;
  pt date;
  b date;
  bucket text;
  res jsonb := '[]'::jsonb;
  month_end date := (p_month + interval '1 month' - interval '1 day')::date;
  is_final boolean := exists (select 1 from public.sales_updates where id = p_update and kind = 'final');
  cs_u date := (select coverage_start from public.sales_updates where id = p_update);
begin
  if exists (select 1 from public.sales_updates where channel_code = p_channel and location_code = p_loc and month = p_month
             and kind = 'final' and status = 'active' and inventory_effect = 'none') then
    return '[]'::jsonb;
  end if;
  for e in
    with eff as (select * from private.effective_sales(p_channel, p_loc, p_month) x where x.item_id is not null)
    select eff.item_id, eff.final_qty + eff.prov_qty as qty, eff.through from eff
    union all
    select s.item_id, 0::numeric, s.last_as_of from public.sales_stock_state s
    where s.channel_code = p_channel and s.location_code = p_loc and s.month = p_month
      and not exists (select 1 from eff where eff.item_id = s.item_id)
  loop
    insert into public.sales_stock_state (channel_code, location_code, month, item_id)
    values (p_channel, p_loc, p_month, e.item_id) on conflict do nothing;
    select * into st from public.sales_stock_state s
    where s.channel_code = p_channel and s.location_code = p_loc and s.month = p_month and s.item_id = e.item_id for update;
    diff := e.qty - (st.deducted_qty + st.absorbed_qty + st.untracked_qty);
    if diff = 0 then
      update public.sales_stock_state set target_qty = e.qty
      where channel_code = p_channel and location_code = p_loc and month = p_month and item_id = e.item_id and target_qty <> e.qty;
      continue;
    end if;
    pt := least(coalesce(e.through, month_end), month_end);
    select max(d.doc_date) into b from public.documents d join public.doc_lines l on l.doc_id = d.id
    where d.status = 'posted' and d.reverses_doc is null and d.doc_type = 'count' and d.location_code = p_loc
      and coalesce(d.data ->> 'baseline', '') = 'true' and l.item_id = e.item_id and d.doc_date > cs_u and d.doc_date < pt;

    if b is not null and coalesce(st.last_as_of, '-infinity'::date) < b then
      bucket := 'spans_baseline';  -- sales before and after the count are mixed in one figure: flag, don't deduct
    elsif not exists (select 1 from public.stock_moves m where m.location_code = p_loc and m.item_id = e.item_id
                   and m.move_date <= pt and m.doc_type <> 'sales_update')
       and not exists (select 1 from public.documents d join public.doc_lines l on l.doc_id = d.id
                   where d.status = 'posted' and d.reverses_doc is null and l.item_id = e.item_id and d.doc_date <= pt
                     and ((d.doc_type = 'count' and d.location_code = p_loc) or (d.doc_type = 'opening' and l.extra ->> 'location' = p_loc))) then
      bucket := 'untracked';
    elsif exists (select 1 from public.documents d join public.doc_lines l on l.doc_id = d.id
                   where d.status = 'posted' and d.reverses_doc is null and l.item_id = e.item_id and d.doc_date >= pt
                     and ((d.doc_type = 'count' and d.location_code = p_loc) or (d.doc_type = 'opening' and l.extra ->> 'location' = p_loc))) then
      bucket := 'absorbed';
    else
      bucket := 'deducted';
      perform private.move(pt, e.item_id, p_loc, -diff, case when is_final then 'sale_reconcile' else 'sale' end, 'sales_update', p_update);
    end if;

    update public.sales_stock_state set
      target_qty = e.qty,
      deducted_qty = deducted_qty + case when bucket = 'deducted' then diff else 0 end,
      absorbed_qty = absorbed_qty + case when bucket in ('absorbed', 'spans_baseline') then diff else 0 end,
      untracked_qty = untracked_qty + case when bucket = 'untracked' then diff else 0 end,
      last_as_of = greatest(last_as_of, pt),
      history = history || jsonb_build_object('at', now(), 'update', p_update, 'diff', diff, 'bucket', bucket, 'date', pt, 'baseline', b),
      updated_at = now()
    where channel_code = p_channel and location_code = p_loc and month = p_month and item_id = e.item_id;
    res := res || jsonb_build_object('item_id', e.item_id, 'diff', diff, 'bucket', bucket, 'date', pt);
  end loop;
  return res;
end $$;

-- ---------- reads: inventory effect per update, historical months, baselines ----------
do $$
declare
  def text := pg_get_functiondef('public.consignment_sales(text, text, date, date)'::regprocedure);
begin
  if position('''inventory_effect''' in def) = 0 then
    def := replace(def, '''source'', u.source, ''doc_id'', u.doc_id,',
      '''source'', u.source, ''doc_id'', u.doc_id, ''inventory_effect'', u.inventory_effect, ''superseded_by'', u.superseded_by,');
    def := replace(def, '''month'', m, ''state'', st,',
      '''month'', m, ''state'', st, ''historical'', exists (select 1 from public.sales_updates where channel_code = p_channel and location_code = p_loc and month = m and kind = ''final'' and status = ''active'' and inventory_effect = ''none''),');
    if position('''inventory_effect''' in def) = 0 or position('''historical''' in def) = 0 then raise exception 'consignment_sales: anchors not found'; end if;
    execute def;
  end if;
  def := pg_get_functiondef('public.consignment_stock(text, date, date)'::regprocedure);
  if position('''baseline''' in def) = 0 then
    def := replace(def, 'return jsonb_build_object(''location'', p_loc, ''month'', ms, ''today'', p_today,',
      'return jsonb_build_object(''location'', p_loc, ''month'', ms, ''today'', p_today,
    ''baseline'', (select to_jsonb(b) - ''client_key'' || jsonb_build_object(''items'', (select coalesce(jsonb_agg(bl.item_id), ''[]''::jsonb) from public.stock_baseline_lines bl where bl.baseline_id = b.id))
      from public.stock_baselines b where b.location_code = p_loc and b.status = ''confirmed'' order by b.effective_at desc limit 1),
    ''baseline_drafts'', (select count(*) from public.stock_baselines b where b.location_code = p_loc and b.status = ''draft''),');
    if position('''baseline''' in def) = 0 then raise exception 'consignment_stock: anchor not found'; end if;
    execute def;
  end if;
  def := pg_get_functiondef('public.business_report(date, date, text)'::regprocedure);
  if position('''report_returns''' in def) = 0 then
    def := replace(def, '''returns'', jsonb_build_object(''count'', (select count(*) from returned), ''amount'', coalesce((select sum(total) from returned), 0)),',
      '''returns'', jsonb_build_object(''count'', (select count(*) from returned), ''amount'', coalesce((select sum(total) from returned), 0),
      ''report_returns'', coalesce((select sum((data ->> ''returns_amount'')::numeric) from docs where doc_type = ''consignment''), 0),
      ''sales_before_returns'', coalesce((select sum((data ->> ''sales_before_returns'')::numeric) from docs where doc_type = ''consignment'' and data ? ''sales_before_returns''), 0)),');
    if position('''report_returns''' in def) = 0 then raise exception 'business_report: anchor not found'; end if;
    execute def;
  end if;
end $$;

-- ---------- stock baselines ----------
-- A draft records the actual count; confirming it (owner) posts a count dated at the effective date
-- whose adjustments are worked out against the balance on that date, so later movements stay.
create or replace function public.save_stock_baseline(p jsonb) returns public.stock_baselines
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.member_id();
  b public.stock_baselines;
  loc text := p ->> 'location_code';
  at timestamptz := (p ->> 'effective_at')::timestamptz;
  l jsonb;
begin
  perform private.require(me is not null, 'not_member');
  perform private.require(nullif(p ->> 'client_key', '') is not null, 'client_key_required');
  select * into b from public.stock_baselines where client_key = (p ->> 'client_key')::uuid;
  if found then return b; end if;
  perform private.require(exists (select 1 from public.locations where code = loc and active and kind <> 'transit'), 'location_required');
  perform private.require(at is not null, 'date_required');
  perform private.require(at <= now() + interval '1 hour', 'date_future');
  perform private.require(coalesce(btrim(p ->> 'counted_by'), '') <> '', 'counted_by_required');
  perform private.require(jsonb_array_length(coalesce(p -> 'lines', '[]'::jsonb)) > 0, 'lines_required');
  insert into public.stock_baselines (location_code, effective_at, counted_by, note, client_key, recorded_by)
  values (loc, at, btrim(p ->> 'counted_by'), nullif(btrim(p ->> 'note'), ''), (p ->> 'client_key')::uuid, me)
  returning * into b;
  for l in select * from jsonb_array_elements(p -> 'lines') loop
    perform private.require(private.item_kind((l ->> 'item_id')::uuid) is not null, 'unknown_item');
    perform private.require(coalesce((l ->> 'qty')::numeric, -1) >= 0, 'qty_positive');
    insert into public.stock_baseline_lines (baseline_id, item_id, qty) values (b.id, (l ->> 'item_id')::uuid, (l ->> 'qty')::numeric);
  end loop;
  return b;
end $$;

create or replace function public.cancel_stock_baseline(p_id uuid, p_reason text) returns public.stock_baselines
language plpgsql security definer set search_path = '' as $$
declare
  b public.stock_baselines;
begin
  perform private.require(private.member_id() is not null, 'not_member');
  perform private.require(coalesce(btrim(p_reason), '') <> '', 'reason_required');
  update public.stock_baselines set status = 'cancelled', note = concat_ws(' · ', note, btrim(p_reason)), updated_at = now()
  where id = p_id and status = 'draft' and (recorded_by = private.member_id() or private.is_owner())
  returning * into b;
  perform private.require(found, 'not_pending');
  return b;
end $$;

create or replace function public.confirm_stock_baseline(p_id uuid) returns public.stock_baselines
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.member_id();
  b public.stock_baselines;
  d public.documents;
  dt date;
  l record;
  bal numeric;
  i integer := 0;
begin
  perform private.require(private.is_owner(), 'owner_only');
  select * into b from public.stock_baselines where id = p_id for update;
  perform private.require(found, 'not_found');
  if b.status = 'confirmed' then return b; end if;
  perform private.require(b.status = 'draft', 'not_pending');
  dt := (b.effective_at at time zone 'Asia/Bangkok')::date;
  perform private.assert_open(dt);
  insert into public.documents (doc_no, doc_type, doc_date, location_code, status, total, data, note, needs_approval,
    approved_by, approved_at, client_key, created_by)
  values (private.next_doc_no('count', dt), 'count', dt, b.location_code, 'posted', null,
    jsonb_build_object('baseline', true, 'baseline_id', b.id, 'effective_at', b.effective_at, 'counted_by', b.counted_by),
    coalesce(b.note, 'Stock baseline'), false, me, now(), md5(b.id::text || '|baseline')::uuid, me)
  returning * into d;
  for l in select * from public.stock_baseline_lines where baseline_id = b.id order by item_id loop
    i := i + 1;
    select coalesce(sum(qty), 0) into bal from public.stock_moves where item_id = l.item_id and location_code = b.location_code and move_date <= dt;
    insert into public.doc_lines (doc_id, line_no, item_id, qty, extra)
    values (d.id, i, l.item_id, l.qty, jsonb_build_object('system_qty_at_posting', bal, 'baseline', true));
    if l.qty - bal <> 0 then
      perform private.move(dt, l.item_id, b.location_code, l.qty - bal, 'count_adjust', 'count', d.id);
    end if;
  end loop;
  update public.stock_baselines set status = 'confirmed', confirmed_by = me, confirmed_at = now(), count_doc = d.id, updated_at = now()
  where id = b.id returning * into b;
  perform private.log('confirm', 'stock_baselines', b.id::text, 'Stock baseline ' || b.location_code || ' ' || b.effective_at);
  return b;
end $$;

-- ---------- event rows: allocate to products later, through an audited revision ----------
-- Builds the same official report again with the chosen products and saves it as the next version
-- (commit_sales_update): the monthly total, rows and amounts stay identical; only attribution
-- changes, and a sales-only report stays sales-only.
create or replace function public.allocate_report_rows(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u public.sales_updates;
  d public.documents;
  alloc jsonb := coalesce(p -> 'allocations', '[]'::jsonb);
  rep jsonb;
begin
  perform private.require(private.is_owner(), 'owner_only');
  perform private.require(coalesce(btrim(p ->> 'note'), '') <> '', 'reason_required');
  select * into u from public.sales_updates where id = (p ->> 'update_id')::uuid and kind = 'final' and status = 'active';
  perform private.require(found, 'not_replaceable');
  select * into d from public.documents where id = u.doc_id;
  perform private.require(not exists (select 1 from jsonb_array_elements(alloc) a
    where nullif(a ->> 'item_id', '') is not null and private.item_kind((a ->> 'item_id')::uuid) is distinct from 'product'), 'unknown_item');
  rep := jsonb_build_object(
    'report_no', d.data ->> 'report_no', 'branch_code', d.data ->> 'branch_code', 'branch_name', d.data ->> 'branch_name',
    'period_code', d.data ->> 'period_code', 'period_start', d.data ->> 'period_start', 'period_end', d.data ->> 'period_end',
    'generated_at', d.data ->> 'generated_at', 'gp_percent', (d.data ->> 'gp_percent')::numeric, 'row_identity', true,
    'source', d.data -> 'import' -> 'source', 'method', 'Product allocation of report rows: ' || btrim(p ->> 'note'),
    'totals', jsonb_build_object('units', (d.data ->> 'units')::numeric, 'net_sales', d.total, 'gp_amount', (d.data ->> 'gp_amount')::numeric,
      'supplier_amount', (d.data ->> 'amount_due')::numeric, 'vat_amount', coalesce((d.data ->> 'vat_amount')::numeric, 0)),
    'lines', (select jsonb_agg(jsonb_build_object(
        'row', coalesce(l.extra -> 'row', to_jsonb(l.line_no)), 'type', coalesce(l.extra ->> 'type', 'S'),
        'item_code', l.extra ->> 'item_code', 'barcode', l.extra ->> 'barcode', 'description', l.extra ->> 'source_name',
        'qty', l.qty, 'unit_price', l.unit_price, 'sales_amount', (l.extra ->> 'sales_amount')::numeric,
        'discount', coalesce((l.extra ->> 'discount')::numeric, 0), 'net_sales', l.amount,
        'supplier_amount', (l.extra ->> 'supplier_amount')::numeric, 'mapping', l.extra -> 'mapping')
        || case when coalesce(a.item_id, l.item_id) is not null then jsonb_build_object('item_id', coalesce(a.item_id, l.item_id))
                else jsonb_build_object('allocation', 'pending') end
        order by l.line_no)
      from public.doc_lines l
      left join lateral (select nullif(x ->> 'item_id', '')::uuid as item_id from jsonb_array_elements(alloc) x
        where (x ->> 'row') = coalesce(l.extra ->> 'row', l.line_no::text) limit 1) a on true
      where l.doc_id = d.id));
  return public.commit_sales_update(jsonb_build_object('kind', 'final', 'channel', u.channel_code, 'location_code', u.location_code,
    'report', rep, 'revision_of', u.id, 'inventory_effect', u.inventory_effect,
    'source', u.source || jsonb_build_object('allocation_note', btrim(p ->> 'note'), 'allocated_at', now())));
end $$;

revoke all on function public.save_stock_baseline(jsonb), public.cancel_stock_baseline(uuid, text), public.confirm_stock_baseline(uuid),
  public.allocate_report_rows(jsonb) from public, anon;
grant execute on function public.save_stock_baseline(jsonb), public.cancel_stock_baseline(uuid, text), public.confirm_stock_baseline(uuid),
  public.allocate_report_rows(jsonb) to authenticated;

-- Rows without a product (event sales awaiting allocation) are one group: join them null-safely so
-- their totals are counted.
do $$
declare
  def text := pg_get_functiondef('private.effective_sales(text, text, date)'::regprocedure);
begin
  if position('is not distinct from it.item_id' in def) > 0 then return; end if;
  def := replace(def, 'left join fin_l f on f.item_id = it.item_id', 'left join fin_l f on f.item_id is not distinct from it.item_id');
  def := replace(def, 'left join snap_l s on s.item_id = it.item_id', 'left join snap_l s on s.item_id is not distinct from it.item_id');
  def := replace(def, 'left join int_l n on n.item_id = it.item_id', 'left join int_l n on n.item_id is not distinct from it.item_id');
  if position('fin_l f on f.item_id is not distinct from' in def) = 0 then raise exception 'effective_sales: anchors not found'; end if;
  execute def;
end $$;
