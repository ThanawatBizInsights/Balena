-- ICONSIAM workspace, part 2: the authoritative sales layer.
--
-- Rules (see ops/README.md, "ICONSIAM"):
-- - An official final report is authoritative for the period it covers. Interim updates inside
--   that period are superseded (kept for audit, left out of totals).
-- - A cumulative month-to-date snapshot replaces earlier snapshots: 10 then 16 means 16, not 26.
-- - Interval updates inside the latest snapshot's coverage are already in it; intervals after it
--   are added. An interval that only partly overlaps a snapshot or final is a conflict: it is left
--   out of totals and shown for review. Two intervals may not cover the same day for one product.
-- - Stock: each reconciliation compares the month's authoritative quantity with what the layer
--   already applied and posts only the difference (dated at the end of the coverage, never as a
--   made-up daily sale). A difference already reflected by a count/opening dated on or after that
--   point is "absorbed" (no second deduction). Sales before stock was tracked at the location
--   (no opening, count or receipt yet) are "untracked".
-- - A revised final report is a new version: the old version and its consignment record become
--   "superseded" (kept), and only the difference reaches stock. Payments stay where they are and
--   count toward the current version.
-- - Re-importing the same source changes nothing.

-- Official reports can now hand stock to the sales layer, and a reissued report gets its own identity.
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
  by_layer boolean := coalesce((p ->> 'stock_by_layer')::boolean, false);
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

  stock_ok := not by_layer and exists (select 1 from public.stock_moves where location_code = loc and move_date < ps);
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
      -- 'layer': stock is reconciled by the sales layer (only the difference from interim updates).
      'stock', case when by_layer then 'layer' when stock_ok then 'deduct' else 'not_reconciled' end,
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
      insert into public.stock_items (code, name_en, name_th, kind, base_unit, category, category_code, size_confirmed, iconsiam_code, barcode, active)
      values ('LEGACY-' || ch.code || '-' || (l ->> 'item_code'), l ->> 'description', l ->> 'description', 'product', 'pc', 'other', 'FIN',
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

  -- With the sales layer, stock moves come from the layer's reconciliation, never from here.
  if d.status = 'posted' and not by_layer then perform private.apply_effects(d.id); end if;
  perform private.log('import', 'documents', d.id::text, 'Sales report ' || (p ->> 'report_no'), d.data -> 'import');
  return d;
end $$;


-- ---------- payments follow the current version of a report ----------
create or replace function private.current_doc(p_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  with recursive c(id, n) as (
    select p_id, 0
    union all
    select (d.data ->> 'superseded_by')::uuid, c.n + 1
    from c join public.documents d on d.id = c.id
    where d.data ? 'superseded_by' and c.n < 20
  )
  select id from c order by n desc limit 1
$$;
grant execute on function private.current_doc(uuid) to authenticated;

create or replace view public.receivables with (security_invoker = true) as
with due as (
  select d.id, d.doc_no, d.doc_type, d.doc_date, d.data ->> 'channel' as channel,
    case when d.doc_type = 'consignment' then (d.data ->> 'amount_due')::numeric else d.total end as amount_due,
    case when d.doc_type = 'consignment' then (d.data ->> 'due_date')::date end as due_date
  from public.documents d
  where d.status = 'posted' and d.reverses_doc is null
    and (d.doc_type = 'consignment' or (d.doc_type = 'sale' and d.data ->> 'paid' in ('payout', 'unpaid')))
), paid as (
  select private.current_doc((p.data ->> 'for_doc')::uuid) as for_doc, sum(p.total) as received,
    bool_or((p.data ->> 'close')::boolean) as closed
  from public.documents p
  where p.doc_type = 'payment' and p.status = 'posted' and p.reverses_doc is null and p.data ->> 'direction' = 'in'
  group by 1
)
select due.*, coalesce(paid.received, 0) as received,
  case when coalesce(paid.closed, false) then 0 else due.amount_due - coalesce(paid.received, 0) end as open_amount,
  case when coalesce(paid.closed, false) then due.amount_due - coalesce(paid.received, 0) else 0 end as settlement_fee
from due left join paid on paid.for_doc = due.id;

-- ---------- what counts, per product, for one channel/location/month ----------
create or replace function private.effective_sales(p_channel text, p_loc text, p_month date)
returns table (item_id uuid, final_qty numeric, final_gross numeric, final_discount numeric, final_net numeric,
  final_gp numeric, final_payable numeric, prov_qty numeric, prov_net numeric, through date, sources uuid[], excluded jsonb)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  snap public.sales_updates;
begin
  select * into snap from public.sales_updates u
  where u.channel_code = p_channel and u.location_code = p_loc and u.month = p_month and u.kind = 'snapshot' and u.status = 'active'
  order by u.as_of desc, u.created_at desc limit 1;

  return query
  with fin as (
    select u.* from public.sales_updates u
    where u.channel_code = p_channel and u.location_code = p_loc and u.month = p_month and u.kind = 'final' and u.status = 'active'
  ), fin_l as (
    select l.item_id, sum(l.qty) as qty, sum(l.gross) as gross, sum(l.discount) as disc, sum(l.net) as net,
      sum(l.gp_amount) as gp, sum(l.payable) as pay, max(f.coverage_end) as thru, array_agg(f.id) as src
    from fin f join public.sales_update_lines l on l.update_id = f.id group by l.item_id
  ), snap_l as (
    -- The latest snapshot, unless a final covers all of it; otherwise what is left after the
    -- finals that fall inside its coverage.
    select l.item_id,
      greatest(0, l.qty - coalesce((select sum(fl.qty) from fin f join public.sales_update_lines fl on fl.update_id = f.id
        where fl.item_id = l.item_id and f.coverage_start >= snap.coverage_start and f.coverage_end <= snap.coverage_end), 0)) as qty,
      greatest(0, coalesce(l.net, 0) - coalesce((select sum(fl.net) from fin f join public.sales_update_lines fl on fl.update_id = f.id
        where fl.item_id = l.item_id and f.coverage_start >= snap.coverage_start and f.coverage_end <= snap.coverage_end), 0)) as net
    from public.sales_update_lines l
    where snap.id is not null and l.update_id = snap.id
      and not exists (select 1 from fin f where f.coverage_start <= snap.coverage_start and f.coverage_end >= snap.coverage_end)
  ), ints as (
    select u.id, u.coverage_start, u.coverage_end,
      case
        when exists (select 1 from fin f where f.coverage_start <= u.coverage_start and f.coverage_end >= u.coverage_end) then 'final'
        when snap.id is not null and u.coverage_start >= snap.coverage_start and u.coverage_end <= snap.coverage_end then 'snapshot'
        when exists (select 1 from fin f where f.coverage_start <= u.coverage_end and f.coverage_end >= u.coverage_start)
          or (snap.id is not null and u.coverage_start <= snap.coverage_end and u.coverage_end >= snap.coverage_start) then 'overlap'
      end as covered_by
    from public.sales_updates u
    where u.channel_code = p_channel and u.location_code = p_loc and u.month = p_month and u.kind = 'interval' and u.status = 'active'
  ), int_l as (
    select l.item_id, sum(l.qty) as qty, sum(coalesce(l.net, 0)) as net, max(i.coverage_end) as thru, array_agg(i.id) as src
    from ints i join public.sales_update_lines l on l.update_id = i.id
    where i.covered_by is null group by l.item_id
  ), its as (
    select fin_l.item_id from fin_l union select snap_l.item_id from snap_l union select int_l.item_id from int_l
  )
  select it.item_id, coalesce(f.qty, 0), f.gross, f.disc, f.net, f.gp, f.pay,
    coalesce(s.qty, 0) + coalesce(n.qty, 0), coalesce(s.net, 0) + coalesce(n.net, 0),
    greatest(f.thru, case when s.item_id is not null then snap.coverage_end end, n.thru),
    coalesce(f.src, '{}'::uuid[]) || case when s.item_id is not null then array[snap.id] else '{}'::uuid[] end || coalesce(n.src, '{}'::uuid[]),
    coalesce((select jsonb_agg(jsonb_build_object('update', i.id, 'reason', 'partial_overlap')) from ints i
      where i.covered_by = 'overlap' and exists (select 1 from public.sales_update_lines x where x.update_id = i.id and x.item_id = it.item_id)), '[]'::jsonb)
  from its it
  left join fin_l f on f.item_id = it.item_id
  left join snap_l s on s.item_id = it.item_id
  left join int_l n on n.item_id = it.item_id;
end $$;

-- ---------- stock: apply only the difference ----------
create or replace function private.reconcile_sales_stock(p_channel text, p_loc text, p_month date, p_update uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  e record;
  st public.sales_stock_state;
  diff numeric;
  pt date;
  bucket text;
  res jsonb := '[]'::jsonb;
  month_end date := (p_month + interval '1 month' - interval '1 day')::date;
  is_final boolean := exists (select 1 from public.sales_updates where id = p_update and kind = 'final');
begin
  for e in
    with eff as (select * from private.effective_sales(p_channel, p_loc, p_month))
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

    if not exists (select 1 from public.stock_moves m where m.location_code = p_loc and m.item_id = e.item_id
                   and m.move_date <= pt and m.doc_type <> 'sales_update')
       and not exists (select 1 from public.documents d join public.doc_lines l on l.doc_id = d.id
                   where d.status = 'posted' and d.reverses_doc is null and l.item_id = e.item_id and d.doc_date <= pt
                     and ((d.doc_type = 'count' and d.location_code = p_loc) or (d.doc_type = 'opening' and l.extra ->> 'location' = p_loc))) then
      bucket := 'untracked';   -- no opening, count or receipt there yet: the later opening/count reflects it
    elsif exists (select 1 from public.documents d join public.doc_lines l on l.doc_id = d.id
                   where d.status = 'posted' and d.reverses_doc is null and l.item_id = e.item_id and d.doc_date >= pt
                     and ((d.doc_type = 'count' and d.location_code = p_loc) or (d.doc_type = 'opening' and l.extra ->> 'location' = p_loc))) then
      bucket := 'absorbed';    -- a count/opening on or after this point already reflects it
    else
      bucket := 'deducted';
      perform private.move(pt, e.item_id, p_loc, -diff, case when is_final then 'sale_reconcile' else 'sale' end, 'sales_update', p_update);
    end if;

    update public.sales_stock_state set
      target_qty = e.qty,
      deducted_qty = deducted_qty + case when bucket = 'deducted' then diff else 0 end,
      absorbed_qty = absorbed_qty + case when bucket = 'absorbed' then diff else 0 end,
      untracked_qty = untracked_qty + case when bucket = 'untracked' then diff else 0 end,
      last_as_of = greatest(last_as_of, pt),
      history = history || jsonb_build_object('at', now(), 'update', p_update, 'diff', diff, 'bucket', bucket, 'date', pt),
      updated_at = now()
    where channel_code = p_channel and location_code = p_loc and month = p_month and item_id = e.item_id;
    res := res || jsonb_build_object('item_id', e.item_id, 'diff', diff, 'bucket', bucket, 'date', pt);
  end loop;
  return res;
end $$;

revoke all on function private.effective_sales(text, text, date), private.reconcile_sales_stock(text, text, date, uuid) from public, anon, authenticated;

-- ---------- product matching for imports: never by barcode alone ----------
-- Order: an item chosen in the preview; a reviewed code mapping; the store's own item code.
-- A barcode only proposes candidates (several products can share one on the source forms).
create or replace function private.match_line(p_channel text, l jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  m public.channel_item_maps;
  it public.stock_items;
  src_code text := coalesce(nullif(l ->> 'source_code', ''), nullif(l ->> 'item_code', ''));
  bc text := nullif(l ->> 'barcode', '');
  cands jsonb;
  issues jsonb := '[]'::jsonb;
begin
  if bc is not null then
    select coalesce(jsonb_agg(distinct x.id), '[]'::jsonb) into cands from (
      select id from public.stock_items where barcode = bc
      union select item_id from public.channel_item_maps where channel_code = p_channel and barcode = bc and item_id is not null) x(id);
    if jsonb_array_length(cands) > 1 then issues := issues || '"barcode_shared"'::jsonb; end if;
  else
    cands := '[]'::jsonb;
  end if;

  if nullif(l ->> 'item_id', '') is not null then
    select * into it from public.stock_items where id = (l ->> 'item_id')::uuid;
    if found then
      return jsonb_build_object('item_id', it.id, 'match', 'chosen', 'candidates', cands, 'issues', issues);
    end if;
  end if;
  if src_code is not null then
    select * into m from public.channel_item_maps where channel_code = p_channel and source_code = src_code;
    if found and m.item_id is not null and m.status = 'reviewed' then
      return jsonb_build_object('item_id', m.item_id, 'match', 'map', 'map_id', m.id, 'candidates', cands, 'issues', issues);
    elsif found then
      return jsonb_build_object('item_id', null, 'match', 'map_unreviewed', 'map_id', m.id, 'suggested', m.item_id,
        'candidates', cands, 'issues', issues || m.issues);
    end if;
    select * into it from public.stock_items where iconsiam_code = src_code;
    if found then
      return jsonb_build_object('item_id', it.id, 'match', 'store_code', 'candidates', cands, 'issues', issues);
    end if;
  end if;
  return jsonb_build_object('item_id', null, 'match', case when jsonb_array_length(cands) > 0 then 'barcode_only' else 'none' end,
    'candidates', cands, 'issues', issues);
end $$;

-- ---------- record one sales update (interval, snapshot or official final) ----------
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
  mo date;
  ref text := nullif(btrim(p ->> 'source_ref'), '');
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
begin
  perform private.require(me is not null, 'not_member');
  perform private.require(private.sees_money(), 'not_allowed');
  perform private.require(k in ('interval', 'snapshot', 'final'), 'update_kind');
  perform private.require(exists (select 1 from public.channels where code = ch and kind = 'consignment' and active), 'channel_required');
  perform private.require(exists (select 1 from public.locations where code = loc and kind = 'consignment' and active), 'consignment_location');

  if k = 'final' then
    -- Official monthly report: owner only; import_sales_report re-checks every line and the totals.
    perform private.require(private.is_owner(), 'owner_only');
    perform private.require(rep is not null, 'lines_required');
    cs := (rep ->> 'period_start')::date;
    ce := (rep ->> 'period_end')::date;
    ao := greatest(coalesce((rep ->> 'generated_at')::date, ce), ce);
    h := md5(jsonb_build_object('lines', rep -> 'lines', 'totals', rep -> 'totals', 'gp', rep -> 'gp_percent')::text);
  else
    perform private.require(ref is not null, 'source_ref_required');
    perform private.require(jsonb_array_length(lines) > 0, 'lines_required');
    if k = 'snapshot' then ao := coalesce(ao, ce); end if;
    ao := coalesce(ao, ce);
  end if;
  perform private.require(cs is not null and ce is not null and ce >= cs, 'period_required');
  mo := date_trunc('month', cs)::date;
  perform private.require(date_trunc('month', ce)::date = mo, 'period_one_month');
  perform private.require(ao >= ce, 'as_of_before_coverage');
  if k = 'snapshot' then
    -- Month-to-date: always from the first of the month to the "as of" day.
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
    -- An explicit correction replaces earlier intervals; otherwise two intervals may not cover the
    -- same day for the same product (that sale would count twice).
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
      -- A second official report for the same period must be confirmed as a revision.
      perform private.require(coalesce(p ->> 'revision_of', '') = prev.id::text, 'final_exists',
        jsonb_build_object('update', prev.id, 'version', prev.version));
      perform private.require(prev.coverage_start = cs and prev.coverage_end = ce, 'revision_coverage');
      ver := prev.version + 1;
    end if;
    doc := public.import_sales_report(rep || jsonb_build_object('stock_by_layer', true, 'channel', ch, 'location_code', loc,
      'revision', case when ver > 1 then 'r' || ver end));
    perform private.require(doc.status = 'posted', 'not_posted');
    perform private.require(not exists (select 1 from public.sales_updates where doc_id = doc.id), 'duplicate_report');
    ref := doc.source_ref;
    insert into public.sales_updates (channel_code, location_code, month, kind, coverage_start, coverage_end, as_of, version,
      source_ref, content_hash, source, doc_id, gp_percent, totals, created_by)
    values (ch, loc, mo, 'final', cs, ce, ao, ver, ref, h,
      coalesce(p -> 'source', '{}'::jsonb) || jsonb_build_object('type', 'official_report', 'report_no', rep ->> 'report_no',
        'branch_code', rep ->> 'branch_code', 'generated_at', rep ->> 'generated_at'),
      doc.id, (doc.data ->> 'gp_percent')::numeric,
      jsonb_build_object('units', doc.data -> 'units', 'gross', doc.data -> 'sales_amount', 'discount', doc.data -> 'discount_total',
        'net', doc.total, 'gp', doc.data -> 'gp_amount', 'payable', doc.data -> 'amount_due'), me)
    returning * into u;
    insert into public.sales_update_lines (update_id, line_no, item_id, source_code, barcode, description, qty, unit_price, gross, discount, net, gp_amount, payable)
    select u.id, dl.line_no, dl.item_id, dl.extra ->> 'item_code', dl.extra ->> 'barcode', dl.extra ->> 'source_name', dl.qty, dl.unit_price,
      (dl.extra ->> 'sales_amount')::numeric, (dl.extra ->> 'discount')::numeric, dl.amount, (dl.extra ->> 'gp_amount')::numeric,
      (dl.extra ->> 'supplier_amount')::numeric
    from public.doc_lines dl where dl.doc_id = doc.id;
    if prev.id is not null then
      update public.sales_updates set status = 'superseded', superseded_by = u.id where id = prev.id;
      update public.documents set status = 'superseded', data = data || jsonb_build_object('superseded_by', doc.id)
      where id = prev.doc_id;
      perform private.log('supersede', 'documents', prev.doc_id::text, 'Revised report v' || ver);
    end if;
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

  stock := private.reconcile_sales_stock(ch, loc, mo, u.id);
  perform private.log('sales_update', 'sales_updates', u.id::text, k || ' ' || ref, jsonb_build_object('stock', stock));
  return jsonb_build_object('update', to_jsonb(u), 'unchanged', false, 'stock', stock);
end $$;

-- ---------- preview: the same commit, rolled back ----------
create or replace function public.preview_sales_update(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ch text := coalesce(nullif(p ->> 'channel', ''), 'ICONSIAM');
  loc text := coalesce(nullif(p ->> 'location_code', ''), 'ICS');
  src jsonb := case when p ->> 'kind' = 'final' then p -> 'report' -> 'lines' else p -> 'lines' end;
  matches jsonb := '[]'::jsonb;
  l jsonb;
  mo date;
  before jsonb;
  res jsonb;
  det text;
begin
  perform private.require(private.member_id() is not null, 'not_member');
  perform private.require(private.sees_money(), 'not_allowed');
  for l in select * from jsonb_array_elements(coalesce(src, '[]'::jsonb)) loop
    matches := matches || (private.match_line(ch, l) || jsonb_build_object('line', l));
  end loop;
  -- Commit needs every interim line matched to a product; finals match by store item code.
  if p ->> 'kind' <> 'final' and exists (select 1 from jsonb_array_elements(matches) x where x ->> 'item_id' is null) then
    return jsonb_build_object('ready', false, 'matches', matches);
  end if;
  mo := date_trunc('month', coalesce((p ->> 'coverage_start')::date, (p -> 'report' ->> 'period_start')::date))::date;
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into before from private.effective_sales(ch, loc, mo) x;
  begin
    res := public.commit_sales_update(case when p ->> 'kind' = 'final' then p else p || jsonb_build_object('lines',
      (select jsonb_agg(x -> 'line' || jsonb_build_object('item_id', x ->> 'item_id')) from jsonb_array_elements(matches) x)) end);
    res := res || jsonb_build_object('after', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from private.effective_sales(ch, loc, mo) x));
    raise exception using errcode = 'BLPRV', message = 'preview', detail = res::text;
  exception
    when sqlstate 'BLPRV' then
      get stacked diagnostics det = pg_exception_detail;
      return jsonb_build_object('ready', true, 'matches', matches, 'before', before) || det::jsonb;
    when others then
      get stacked diagnostics det = pg_exception_detail;
      return jsonb_build_object('ready', false, 'matches', matches, 'before', before, 'error', sqlerrm, 'error_detail', det);
  end;
end $$;

revoke all on function private.match_line(text, jsonb) from public, anon, authenticated;
revoke all on function public.commit_sales_update(jsonb), public.preview_sales_update(jsonb) from public, anon;
grant execute on function public.commit_sales_update(jsonb), public.preview_sales_update(jsonb) to authenticated;

-- ---------- existing official reports join the layer (no stock change) ----------
insert into public.sales_updates (channel_code, location_code, month, kind, coverage_start, coverage_end, as_of, version,
  source_ref, content_hash, source, doc_id, gp_percent, totals, created_by, created_at)
select d.data ->> 'channel', d.location_code, date_trunc('month', (d.data ->> 'period_start')::date)::date, 'final',
  (d.data ->> 'period_start')::date, (d.data ->> 'period_end')::date,
  greatest(coalesce((d.data ->> 'generated_at')::date, (d.data ->> 'period_end')::date), (d.data ->> 'period_end')::date), 1,
  d.source_ref, 'legacy:' || d.source_ref,
  coalesce(d.data -> 'import', '{}'::jsonb) || jsonb_build_object('type', 'official_report', 'report_no', d.data ->> 'report_no',
    'branch_code', d.data ->> 'branch_code', 'generated_at', d.data ->> 'generated_at'),
  d.id, (d.data ->> 'gp_percent')::numeric,
  jsonb_build_object('units', d.data -> 'units', 'gross', d.data -> 'sales_amount', 'discount', d.data -> 'discount_total',
    'net', d.total, 'gp', d.data -> 'gp_amount', 'payable', d.data -> 'amount_due'),
  d.created_by, d.created_at
from public.documents d
where d.doc_type = 'consignment' and d.status = 'posted' and d.reverses_doc is null and d.source_ref is not null
  and not exists (select 1 from public.sales_updates u where u.doc_id = d.id);

insert into public.sales_update_lines (update_id, line_no, item_id, source_code, barcode, description, qty, unit_price, gross, discount, net, gp_amount, payable)
select u.id, dl.line_no, dl.item_id, dl.extra ->> 'item_code', dl.extra ->> 'barcode', dl.extra ->> 'source_name', dl.qty, dl.unit_price,
  (dl.extra ->> 'sales_amount')::numeric, (dl.extra ->> 'discount')::numeric, dl.amount, (dl.extra ->> 'gp_amount')::numeric,
  (dl.extra ->> 'supplier_amount')::numeric
from public.sales_updates u join public.doc_lines dl on dl.doc_id = u.doc_id
where u.content_hash like 'legacy:%' and not exists (select 1 from public.sales_update_lines x where x.update_id = u.id);

-- What those reports already did to stock: "deduct" took the full quantity; "not_reconciled" took none.
insert into public.sales_stock_state (channel_code, location_code, month, item_id, target_qty, deducted_qty, untracked_qty, last_as_of, history)
select u.channel_code, u.location_code, u.month, l.item_id, sum(l.qty),
  coalesce(sum(l.qty) filter (where d.data ->> 'stock' = 'deduct'), 0),
  coalesce(sum(l.qty) filter (where d.data ->> 'stock' <> 'deduct'), 0),
  max(u.coverage_end),
  jsonb_build_array(jsonb_build_object('at', now(), 'update', min(u.id::text), 'bucket', 'legacy', 'note', 'existing official report'))
from public.sales_updates u join public.sales_update_lines l on l.update_id = u.id join public.documents d on d.id = u.doc_id
where u.content_hash like 'legacy:%'
group by u.channel_code, u.location_code, u.month, l.item_id
on conflict do nothing;
