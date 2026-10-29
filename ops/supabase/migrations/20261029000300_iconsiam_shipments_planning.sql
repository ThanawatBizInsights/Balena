-- ICONSIAM workspace, part 3: delivery workflow, mappings, profile, planning settings, and the
-- read functions behind the two ICONSIAM tabs.
--
-- Delivery workflow (stock):
--   planned        → nothing moves
--   dispatched     → a transfer record: our branch −qty, In transit +qty
--   received       → In transit −qty; ICONSIAM +accepted; our branch +rejected (sent back);
--                    missing units leave In transit as "transit_missing" (kept on record)
-- A delivery form never counts as a sale, and its GP line is only a reference.

-- ---------- numbering: DN-2026-00001 ----------
create or replace function private.next_ship_no(p_date date) returns text
language plpgsql security definer set search_path = '' as $$
declare
  y integer := extract(year from p_date);
  k integer;
begin
  insert into private.ship_counters (year, n) values (y, 1)
    on conflict (year) do update set n = private.ship_counters.n + 1 returning n into k;
  return 'DN-' || y || '-' || lpad(k::text, 5, '0');
end $$;
revoke all on function private.next_ship_no(date) from public, anon, authenticated;

-- ---------- a mapping proposal for a code seen on a form (never auto-approved) ----------
create or replace function private.propose_map(p_channel text, l jsonb, p_ref text, p_shared boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  code text := nullif(btrim(l ->> 'source_code'), '');
  bc text := nullif(btrim(l ->> 'barcode'), '');
  it public.stock_items;
  issues jsonb := '[]'::jsonb;
  mid uuid;
begin
  if code is null then return null; end if;
  select id into mid from public.channel_item_maps where channel_code = p_channel and source_code = code;
  if mid is not null then return mid; end if;
  if nullif(l ->> 'item_id', '') is not null then
    select * into it from public.stock_items where id = (l ->> 'item_id')::uuid;
  end if;
  if p_shared then issues := issues || '"barcode_shared_on_form"'::jsonb; end if;
  if it.id is null then issues := issues || '"no_item"'::jsonb; end if;
  if it.id is not null and bc is not null and it.barcode is not null and it.barcode <> bc then
    issues := issues || '"barcode_differs_from_item"'::jsonb;
  end if;
  if it.id is not null and nullif(l ->> 'package_size', '') is not null and it.size_value is not null
     and regexp_replace(l ->> 'package_size', '[^0-9]', '', 'g') <> round(it.size_value)::text then
    issues := issues || '"package_size_differs"'::jsonb;
  end if;
  insert into public.channel_item_maps (channel_code, source_code, barcode, source_name, package_size, item_id, status, issues, source_ref)
  values (p_channel, code, bc, nullif(l ->> 'description', ''), nullif(l ->> 'package_size', ''), it.id,
    case when jsonb_array_length(issues) > 0 then 'needs_review' else 'proposed' end, issues, p_ref)
  returning id into mid;
  return mid;
end $$;
revoke all on function private.propose_map(text, jsonb, text, boolean) from public, anon, authenticated;

-- ---------- plan a shipment (also used to import a delivery form for review) ----------
create or replace function public.save_shipment(p jsonb) returns public.consignment_shipments
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  me uuid := private.member_id();
  s public.consignment_shipments;
  ch text := coalesce(nullif(p ->> 'channel', ''), 'ICONSIAM');
  loc text := coalesce(nullif(p ->> 'location_code', ''), 'ICS');
  src_loc text := coalesce(nullif(p ->> 'from_location', ''), 'BY');
  dt date := coalesce((p ->> 'doc_date')::date, current_date);
  lines jsonb := coalesce(p -> 'lines', '[]'::jsonb);
  l jsonb;
  i integer := 0;
  m jsonb;
  mid uuid;
  item uuid;
  shared boolean;
  gp numeric;
begin
  perform private.require(me is not null, 'not_member');
  perform private.require(exists (select 1 from public.locations where code = loc and kind = 'consignment' and active), 'consignment_location');
  perform private.require(exists (select 1 from public.locations where code = src_loc and kind = 'own' and active), 'location_required');
  perform private.require(jsonb_array_length(lines) > 0, 'lines_required');
  select gp_percent into gp from public.channel_profiles where channel_code = ch;

  -- A planned delivery is never edited in place: cancel it and plan a new one (history stays).
  -- A retried save, or the same delivery form imported again, returns what is already there.
  select * into s from public.consignment_shipments
  where client_key = nullif(p ->> 'client_key', '')::uuid or (source_ref is not null and source_ref = nullif(p ->> 'source_ref', ''));
  if found then return s; end if;
  perform private.require(nullif(p ->> 'client_key', '') is not null, 'client_key_required');
  insert into public.consignment_shipments (ship_no, channel_code, location_code, from_location, doc_date, planned_dispatch,
    expected_arrival, gp_percent, source, source_ref, attachments, note, client_key, created_by)
  values (private.next_ship_no(dt), ch, loc, src_loc, dt, nullif(p ->> 'planned_dispatch', '')::date,
    nullif(p ->> 'expected_arrival', '')::date, coalesce(nullif(p ->> 'gp_percent', '')::numeric, gp),
    p -> 'source', nullif(p ->> 'source_ref', ''),
    coalesce(array(select jsonb_array_elements_text(p -> 'attachments')), '{}'), nullif(p ->> 'note', ''),
    (p ->> 'client_key')::uuid, me)
  returning * into s;

  for l in select * from jsonb_array_elements(lines) loop
    i := i + 1;
    perform private.require(coalesce((l ->> 'qty')::numeric, 0) > 0, 'qty_positive');
    perform private.require(coalesce((l ->> 'unit_price')::numeric, 0) >= 0, 'amount_required');
    -- The same barcode on two different codes of one form is a red flag, never a match.
    shared := nullif(l ->> 'barcode', '') is not null and exists (select 1 from jsonb_array_elements(lines) o
      where o ->> 'barcode' = l ->> 'barcode' and coalesce(o ->> 'source_code', '') <> coalesce(l ->> 'source_code', ''));
    mid := private.propose_map(ch, l, s.ship_no, shared);
    m := private.match_line(ch, l);
    item := (m ->> 'item_id')::uuid;
    perform private.require(item is null or private.item_kind(item) = 'product', 'unknown_item');
    insert into public.consignment_shipment_lines (shipment_id, line_no, item_id, map_id, source_code, barcode, description,
      package_size, qty, unit_price, amount)
    values (s.id, i, item, coalesce(mid, (m ->> 'map_id')::uuid), nullif(l ->> 'source_code', ''), nullif(l ->> 'barcode', ''),
      nullif(l ->> 'description', ''), nullif(l ->> 'package_size', ''), (l ->> 'qty')::numeric,
      nullif(l ->> 'unit_price', '')::numeric, round((l ->> 'qty')::numeric * coalesce(nullif(l ->> 'unit_price', '')::numeric, 0), 2));
  end loop;
  return s;
end $$;

-- ---------- review a code mapping (owner) ----------
create or replace function public.review_item_map(p jsonb) returns public.channel_item_maps
language plpgsql security definer set search_path = '' as $$
declare
  m public.channel_item_maps;
  st text := p ->> 'status';
begin
  perform private.require(private.is_owner(), 'owner_only');
  perform private.require(st in ('reviewed', 'needs_review', 'rejected'), 'map_status');
  perform private.require(st <> 'reviewed' or private.item_kind(nullif(p ->> 'item_id', '')::uuid) = 'product', 'unknown_item');
  update public.channel_item_maps set item_id = case when st = 'rejected' then null else nullif(p ->> 'item_id', '')::uuid end,
    status = st, reviewed_by = private.member_id(), reviewed_at = now(),
    issues = case when nullif(p ->> 'note', '') is not null then issues || to_jsonb(p ->> 'note') else issues end
  where id = (p ->> 'id')::uuid returning * into m;
  perform private.require(found, 'not_found');
  -- Planned shipment lines waiting on this mapping pick up the reviewed product.
  update public.consignment_shipment_lines l set item_id = case when st = 'reviewed' then m.item_id end
  from public.consignment_shipments s
  where l.map_id = m.id and s.id = l.shipment_id and s.status = 'planned';
  return m;
end $$;

-- ---------- dispatch: branch → in transit ----------
create or replace function public.dispatch_shipment(p_id uuid, p_date date, p_expected date default null) returns public.consignment_shipments
language plpgsql security definer set search_path = '' as $$
declare
  s public.consignment_shipments;
  d public.documents;
begin
  perform private.require(private.member_id() is not null, 'not_member');
  select * into s from public.consignment_shipments where id = p_id for update;
  perform private.require(found, 'not_found');
  if s.status = 'dispatched' then return s; end if;
  perform private.require(s.status = 'planned', 'shipment_not_editable');
  perform private.require(not exists (select 1 from public.consignment_shipment_lines l
    left join public.channel_item_maps m on m.id = l.map_id
    where l.shipment_id = s.id and (l.item_id is null or (m.id is not null and m.status <> 'reviewed'))), 'mapping_review');
  d := public.post_document(jsonb_build_object(
    'doc_type', 'transfer', 'doc_date', p_date, 'location_code', s.from_location,
    'data', jsonb_build_object('to', s.location_code, 'shipment_id', s.id, 'ship_no', s.ship_no),
    'note', 'Delivery ' || s.ship_no,
    'client_key', md5(s.id::text || '|dispatch')::uuid,
    'lines', (select jsonb_agg(jsonb_build_object('item_id', l.item_id, 'qty', l.qty) order by l.line_no)
              from public.consignment_shipment_lines l where l.shipment_id = s.id)));
  perform private.require(d.status = 'posted', 'not_posted');
  update public.consignment_shipments set status = 'dispatched', dispatched_on = p_date, transfer_doc = d.id,
    expected_arrival = coalesce(p_expected, expected_arrival), updated_at = now()
  where id = s.id returning * into s;
  return s;
end $$;

-- ---------- receipt: accepted / rejected / missing per line ----------
create or replace function public.receive_shipment(p jsonb) returns public.consignment_shipments
language plpgsql security definer set search_path = '' as $$
declare
  s public.consignment_shipments;
  l public.consignment_shipment_lines;
  dt date := (p ->> 'date')::date;
  r jsonb;
  a numeric; rj numeric; ms numeric;
  short boolean := false;
  signed boolean := coalesce((p ->> 'signed')::boolean, false);
begin
  perform private.require(private.member_id() is not null, 'not_member');
  perform private.require(dt is not null, 'date_required');
  select * into s from public.consignment_shipments where id = (p ->> 'id')::uuid for update;
  perform private.require(found, 'not_found');
  if s.status in ('received', 'partly_received') then return s; end if;
  perform private.require(s.status = 'dispatched', 'not_receivable');
  perform private.require(dt >= s.dispatched_on, 'date_before_dispatch');
  for l in select * from public.consignment_shipment_lines where shipment_id = s.id order by line_no loop
    r := coalesce(p -> 'lines' -> l.id::text, '{}'::jsonb);
    rj := coalesce((r ->> 'rejected')::numeric, 0);
    ms := coalesce((r ->> 'missing')::numeric, 0);
    a := coalesce((r ->> 'accepted')::numeric, l.qty - rj - ms);
    perform private.require(a >= 0 and rj >= 0 and ms >= 0 and a + rj + ms = l.qty, 'receipt_mismatch',
      jsonb_build_object('line', l.line_no, 'qty', l.qty, 'accepted', a, 'rejected', rj, 'missing', ms));
    if rj + ms > 0 then short := true; end if;
    if a + rj > 0 then perform private.move(dt, l.item_id, 'TRANSIT', -(a + rj), 'transit_out', 'transfer', s.transfer_doc); end if;
    if ms > 0 then perform private.move(dt, l.item_id, 'TRANSIT', -ms, 'transit_missing', 'transfer', s.transfer_doc); end if;
    if a > 0 then perform private.move(dt, l.item_id, s.location_code, a, 'transfer_in', 'transfer', s.transfer_doc); end if;
    if rj > 0 then perform private.move(dt, l.item_id, s.from_location, rj, 'transfer_rejected', 'transfer', s.transfer_doc); end if;
    update public.consignment_shipment_lines set accepted = a, rejected = rj, missing = ms where id = l.id;
  end loop;
  perform private.require(not short or coalesce(btrim(p ->> 'note'), '') <> '', 'reason_required');
  update public.documents set data = data || jsonb_build_object('received_at', dt, 'received_by', private.member_id(), 'receipt_note', p ->> 'note')
  where id = s.transfer_doc;
  update public.consignment_shipments set status = case when short then 'partly_received' else 'received' end,
    received_on = dt, receipt_note = nullif(p ->> 'note', ''),
    receipt_status = case when signed then 'confirmed' else 'received_unsigned' end,
    signatures = signatures || coalesce(p -> 'signatures', '{}'::jsonb) || jsonb_build_object('signed', signed),
    updated_at = now()
  where id = s.id returning * into s;
  perform private.log('receive', 'consignment_shipments', s.id::text, p ->> 'note');
  return s;
end $$;

create or replace function public.cancel_shipment(p_id uuid, p_reason text) returns public.consignment_shipments
language plpgsql security definer set search_path = '' as $$
declare
  s public.consignment_shipments;
begin
  perform private.require(private.member_id() is not null, 'not_member');
  perform private.require(coalesce(btrim(p_reason), '') <> '', 'reason_required');
  update public.consignment_shipments set status = 'cancelled', note = concat_ws(' · ', note, p_reason), updated_at = now()
  where id = p_id and status = 'planned' returning * into s;
  perform private.require(found, 'shipment_not_editable');
  return s;
end $$;

-- A transfer that belongs to a delivery is received through the delivery (accepted/rejected/missing).
create or replace function public.receive_transfer(p_id uuid, p_date date, p_received jsonb, p_reason text default null) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare
  d public.documents;
  l public.doc_lines;
  got numeric;
  short boolean := false;
begin
  perform private.require(private.member_id() is not null, 'not_member');
  select * into d from public.documents where id = p_id for update;
  perform private.require(found and d.doc_type = 'transfer' and d.status = 'posted' and (d.data ->> 'received_at') is null, 'not_receivable');
  perform private.require(not (d.data ? 'shipment_id'), 'use_shipment_receipt');
  for l in select * from public.doc_lines where doc_id = p_id order by line_no loop
    got := coalesce((p_received ->> l.id::text)::numeric, l.qty);
    perform private.require(got >= 0 and got <= l.qty, 'received_too_many');
    if got < l.qty then short := true; end if;
    perform private.move(p_date, l.item_id, 'TRANSIT', -l.qty, 'transit_out', 'transfer', d.id);
    if got > 0 then
      perform private.move(p_date, l.item_id, d.data ->> 'to', got, 'transfer_in', 'transfer', d.id);
    end if;
    update public.doc_lines set extra = extra || jsonb_build_object('received', got, 'short', l.qty - got) where id = l.id;
  end loop;
  perform private.require(not short or coalesce(p_reason, '') <> '', 'reason_required');
  update public.documents set data = data || jsonb_build_object('received_at', p_date, 'received_by', private.member_id(), 'receipt_note', p_reason)
    where id = p_id returning * into d;
  perform private.log('receive', 'documents', p_id::text, p_reason);
  return d;
end $$;

-- ---------- profile (owner) and per-SKU planning settings (members) ----------
create or replace function public.save_channel_profile(p jsonb) returns public.channel_profiles
language plpgsql security definer set search_path = '' as $$
declare
  r public.channel_profiles;
begin
  perform private.require(private.is_owner(), 'owner_only');
  insert into public.channel_profiles (channel_code, supplier, customer, gp_percent, delivery_copies, stock_card_copies, updated_by, updated_at)
  values (coalesce(nullif(p ->> 'channel', ''), 'ICONSIAM'), coalesce(p -> 'supplier', '{}'::jsonb), coalesce(p -> 'customer', '{}'::jsonb),
    nullif(p ->> 'gp_percent', '')::numeric, coalesce(nullif(p ->> 'delivery_copies', '')::integer, 4),
    coalesce(nullif(p ->> 'stock_card_copies', '')::integer, 1), private.member_id(), now())
  on conflict (channel_code) do update set supplier = excluded.supplier, customer = excluded.customer,
    gp_percent = excluded.gp_percent, delivery_copies = excluded.delivery_copies,
    stock_card_copies = excluded.stock_card_copies, updated_by = excluded.updated_by, updated_at = now()
  returning * into r;
  return r;
end $$;

create or replace function public.save_plan_settings(p jsonb) returns public.consignment_plan_settings
language plpgsql security definer set search_path = '' as $$
declare
  r public.consignment_plan_settings;
begin
  perform private.require(private.member_id() is not null, 'not_member');
  perform private.require(private.item_kind(nullif(p ->> 'item_id', '')::uuid) = 'product', 'unknown_item');
  perform private.require(p ->> 'method' <> 'manual' or (nullif(p ->> 'manual_daily', '') is not null and coalesce(btrim(p ->> 'manual_note'), '') <> ''),
    'manual_needs_reason');
  insert into public.consignment_plan_settings (location_code, item_id, prep_days, transit_days, safety_days, target_cover_days,
    pack_multiple, min_shipment, shelf_life_days, shelf_life_verified, window_days, method, manual_daily, manual_note, updated_by, updated_at)
  values (coalesce(nullif(p ->> 'location_code', ''), 'ICS'), (p ->> 'item_id')::uuid,
    coalesce(nullif(p ->> 'prep_days', '')::integer, 4), nullif(p ->> 'transit_days', '')::integer,
    nullif(p ->> 'safety_days', '')::integer, nullif(p ->> 'target_cover_days', '')::integer,
    coalesce(nullif(p ->> 'pack_multiple', '')::integer, 1), coalesce(nullif(p ->> 'min_shipment', '')::integer, 0),
    nullif(p ->> 'shelf_life_days', '')::integer, coalesce((p ->> 'shelf_life_verified')::boolean, false),
    coalesce(nullif(p ->> 'window_days', '')::integer, 28), coalesce(nullif(p ->> 'method', ''), 'auto'),
    nullif(p ->> 'manual_daily', '')::numeric, nullif(btrim(p ->> 'manual_note'), ''), private.member_id(), now())
  on conflict (location_code, item_id) do update set prep_days = excluded.prep_days, transit_days = excluded.transit_days,
    safety_days = excluded.safety_days, target_cover_days = excluded.target_cover_days, pack_multiple = excluded.pack_multiple,
    min_shipment = excluded.min_shipment, shelf_life_days = excluded.shelf_life_days,
    shelf_life_verified = excluded.shelf_life_verified, window_days = excluded.window_days, method = excluded.method,
    manual_daily = excluded.manual_daily, manual_note = excluded.manual_note, updated_by = excluded.updated_by, updated_at = now()
  returning * into r;
  return r;
end $$;

-- ---------- Tab A: authoritative sales by month ----------
create or replace function public.consignment_sales(p_channel text, p_loc text, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  m date;
  res jsonb := '[]'::jsonb;
  st text;
begin
  perform private.require(private.sees_money(), 'not_allowed');
  m := date_trunc('month', p_from)::date;
  while m <= p_to loop
    select case
        when exists (select 1 from public.sales_updates where channel_code = p_channel and location_code = p_loc and month = m and kind = 'final' and status = 'active' and version > 1) then 'revised'
        when exists (select 1 from public.sales_updates where channel_code = p_channel and location_code = p_loc and month = m and kind = 'final' and status = 'active') then 'finalised'
        when exists (select 1 from public.sales_updates where channel_code = p_channel and location_code = p_loc and month = m and status = 'active') then 'provisional'
        else 'open' end into st;
    res := res || jsonb_build_object(
      'month', m, 'state', st,
      'as_of', (select max(as_of) from public.sales_updates where channel_code = p_channel and location_code = p_loc and month = m and status = 'active'),
      'through', (select max(coverage_end) from public.sales_updates where channel_code = p_channel and location_code = p_loc and month = m and status = 'active'),
      'updates', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'kind', u.kind, 'version', u.version, 'status', u.status,
          'coverage_start', u.coverage_start, 'coverage_end', u.coverage_end, 'as_of', u.as_of, 'source_ref', u.source_ref,
          'source', u.source, 'doc_id', u.doc_id, 'totals', u.totals, 'created_at', u.created_at) order by u.created_at), '[]'::jsonb)
        from public.sales_updates u where u.channel_code = p_channel and u.location_code = p_loc and u.month = m),
      'items', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from private.effective_sales(p_channel, p_loc, m) e),
      'received', (select coalesce(sum(r.received), 0) from public.receivables r
        where r.id in (select doc_id from public.sales_updates where channel_code = p_channel and location_code = p_loc and month = m
          and kind = 'final' and status = 'active')),
      'final_payable', (select coalesce(sum((u.totals ->> 'payable')::numeric), 0) from public.sales_updates u
        where u.channel_code = p_channel and u.location_code = p_loc and u.month = m and u.kind = 'final' and u.status = 'active'));
    m := (m + interval '1 month')::date;
  end loop;
  return jsonb_build_object('months', res, 'gp_percent', (select gp_percent from public.channel_profiles where channel_code = p_channel));
end $$;

-- ---------- Tab B: stock at the location, month flows, inbound, sales series ----------
create or replace function public.consignment_stock(p_loc text, p_month date, p_today date default current_date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ms date := date_trunc('month', p_month)::date;
  me date := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  w0 date := p_today - 120;
  ch text := (select c.code from public.channels c where c.kind = 'consignment' and c.active order by c.code limit 1);
  it record;
  res jsonb := '[]'::jsonb;
begin
  perform private.require(private.member_id() is not null, 'not_member');
  for it in
    select i.* from public.stock_items i
    where i.kind = 'product' and (i.active or exists (select 1 from public.stock_moves x where x.item_id = i.id and x.location_code = p_loc)
      or exists (select 1 from public.sales_update_lines x where x.item_id = i.id))
    order by i.name_en
  loop
    res := res || jsonb_build_object(
      'item_id', it.id, 'code', it.code, 'name_th', it.name_th, 'name_en', it.name_en, 'active', it.active,
      'size_value', it.size_value, 'size_unit', it.size_unit, 'barcode', it.barcode, 'iconsiam_code', it.iconsiam_code,
      'opening', (select coalesce(sum(qty), 0) from public.stock_moves where item_id = it.id and location_code = p_loc and move_date < ms),
      'opening_confirmed', exists (select 1 from public.documents d join public.doc_lines l on l.doc_id = d.id
        where d.status = 'posted' and d.reverses_doc is null and l.item_id = it.id and d.doc_date <= ms
          and ((d.doc_type = 'count' and d.location_code = p_loc) or (d.doc_type = 'opening' and l.extra ->> 'location' = p_loc))),
      'tracked', exists (select 1 from public.stock_moves where item_id = it.id and location_code = p_loc and doc_type <> 'sales_update'),
      'flows', (select jsonb_build_object(
          'opening_recorded', coalesce(sum(m.qty) filter (where m.kind like 'opening%'), 0),
          'received', coalesce(sum(m.qty) filter (where m.kind like 'transfer_in%'), 0),
          'sold', coalesce(-sum(m.qty) filter (where m.doc_type = 'sales_update' or (m.doc_type = 'consignment' and m.kind like 'sale%')), 0),
          'returns', coalesce(sum(m.qty) filter (where m.doc_type = 'adjustment' and d.data ->> 'reason_code' = 'customer_return'), 0),
          'removed', coalesce(-sum(m.qty) filter (where m.kind like 'transfer_out%'), 0),
          'damaged', coalesce(-sum(m.qty) filter (where m.doc_type = 'adjustment' and d.data ->> 'reason_code' in ('damage', 'expiry')), 0),
          'counted', coalesce(sum(m.qty) filter (where m.kind like 'count_adjust%'), 0),
          'total', coalesce(sum(m.qty), 0))
        from public.stock_moves m left join public.documents d on d.id = m.doc_id
        where m.item_id = it.id and m.location_code = p_loc and m.move_date between ms and me),
      'on_hand', (select coalesce(sum(qty), 0) from public.stock_moves where item_id = it.id and location_code = p_loc and move_date <= p_today),
      'daily', (select coalesce(jsonb_agg(jsonb_build_object('date', x.d, 'qty', x.q) order by x.d), '[]'::jsonb) from
        (select move_date as d, sum(qty) as q from public.stock_moves where item_id = it.id and location_code = p_loc and move_date > w0 and move_date <= p_today group by 1) x),
      'balance_before_window', (select coalesce(sum(qty), 0) from public.stock_moves where item_id = it.id and location_code = p_loc and move_date <= w0),
      'inbound', (select coalesce(jsonb_agg(jsonb_build_object('ship_no', s.ship_no, 'shipment_id', s.id, 'status', s.status, 'qty', l.qty,
          'planned_dispatch', s.planned_dispatch, 'dispatched_on', s.dispatched_on, 'expected_arrival', s.expected_arrival) order by s.doc_date), '[]'::jsonb)
        from public.consignment_shipments s join public.consignment_shipment_lines l on l.shipment_id = s.id
        where s.location_code = p_loc and s.status in ('planned', 'dispatched') and l.item_id = it.id),
      'price', (select jsonb_build_object('price', pr.price, 'source', 'price_list', 'valid_from', pr.valid_from)
        from public.prices pr where pr.item_id = it.id and pr.channel_code = ch and pr.status = 'approved'
          and pr.valid_from <= p_today and (pr.valid_to is null or pr.valid_to >= p_today)
        order by pr.valid_from desc limit 1),
      'form_price', (select jsonb_build_object('price', l.unit_price, 'source', 'delivery_form', 'ship_no', s.ship_no)
        from public.consignment_shipment_lines l join public.consignment_shipments s on s.id = l.shipment_id
        where l.item_id = it.id and s.location_code = p_loc and l.unit_price is not null order by s.doc_date desc limit 1),
      'settings', (select to_jsonb(ps) from public.consignment_plan_settings ps where ps.location_code = p_loc and ps.item_id = it.id),
      'month_sales', (select to_jsonb(e) from private.effective_sales(ch, p_loc, ms) e where e.item_id = it.id),
      'dated_sales', (select coalesce(jsonb_agg(jsonb_build_object('start', x.cs, 'end', x.ce, 'qty', x.q, 'kind', x.k) order by x.cs), '[]'::jsonb) from (
          -- Interval updates: their own dated coverage.
          select u.coverage_start as cs, u.coverage_end as ce, l.qty as q, 'interval' as k
          from public.sales_updates u join public.sales_update_lines l on l.update_id = u.id
          where u.kind = 'interval' and u.status = 'active' and u.location_code = p_loc and l.item_id = it.id and u.coverage_end > w0
          union all
          -- Snapshots: the increase since the previous snapshot of the same month, over the days between.
          select coalesce(lag(u.as_of) over w + 1, u.coverage_start), u.as_of,
            l.qty - coalesce(lag(l.qty) over w, 0), 'snapshot'
          from public.sales_updates u join public.sales_update_lines l on l.update_id = u.id
          where u.kind = 'snapshot' and u.status = 'active' and u.location_code = p_loc and l.item_id = it.id and u.as_of > w0
          window w as (partition by u.month order by u.as_of, u.created_at)) x),
      'monthly_sales', (select coalesce(jsonb_agg(jsonb_build_object('month', u.month, 'qty', l.qty, 'days',
          extract(day from (u.month + interval '1 month' - interval '1 day'))) order by u.month), '[]'::jsonb)
        from public.sales_updates u join public.sales_update_lines l on l.update_id = u.id
        where u.kind = 'final' and u.status = 'active' and u.location_code = p_loc and l.item_id = it.id and u.month >= (ms - interval '6 months'))
    );
  end loop;
  return jsonb_build_object('location', p_loc, 'month', ms, 'today', p_today,
    'state', (public.consignment_sales(ch, p_loc, ms, ms) -> 'months' -> 0) - 'items',
    'items', res);
end $$;

-- ---------- one product's movement history at a location ----------
create or replace function public.consignment_item_moves(p_loc text, p_item uuid, p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'date', m.move_date, 'qty', m.qty, 'kind', m.kind, 'doc_type', m.doc_type,
      'doc_id', m.doc_id, 'provisional', m.provisional,
      'ref', coalesce(d.doc_no, s.ship_no, u.source_ref), 'reason', coalesce(d.data ->> 'reason_code', d.data ->> 'reason', u.kind),
      'shipment_id', s.id) order by m.move_date, m.id), '[]'::jsonb)
  from public.stock_moves m
  left join public.documents d on d.id = m.doc_id
  left join public.consignment_shipments s on s.transfer_doc = m.doc_id
  left join public.sales_updates u on u.id = m.doc_id
  where private.is_member() and m.item_id = p_item and m.location_code = p_loc and m.move_date between p_from and p_to
$$;

revoke all on function public.save_shipment(jsonb), public.review_item_map(jsonb), public.dispatch_shipment(uuid, date, date),
  public.receive_shipment(jsonb), public.cancel_shipment(uuid, text), public.save_channel_profile(jsonb),
  public.save_plan_settings(jsonb), public.consignment_sales(text, text, date, date), public.consignment_stock(text, date, date),
  public.consignment_item_moves(text, uuid, date, date) from public, anon;
grant execute on function public.save_shipment(jsonb), public.review_item_map(jsonb), public.dispatch_shipment(uuid, date, date),
  public.receive_shipment(jsonb), public.cancel_shipment(uuid, text), public.save_channel_profile(jsonb),
  public.save_plan_settings(jsonb), public.consignment_sales(text, text, date, date), public.consignment_stock(text, date, date),
  public.consignment_item_moves(text, uuid, date, date) to authenticated;
