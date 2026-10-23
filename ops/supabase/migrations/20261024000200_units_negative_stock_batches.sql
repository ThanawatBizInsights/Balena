-- Entry units, temporary negative stock, stock adjustments and output-first production batches.
-- Applied to the project in smaller steps (units_and_negative_stock, record_types_and_batch_status,
-- apply_effects_batches, post_document_units_batches, batch_consumption_and_completion,
-- reverse_document_batches); the definitions below are the ones applied. The full function bodies
-- of apply_effects, post_document and reverse_document are kept in the project and listed by
-- `select pg_get_functiondef('public.post_document(jsonb)'::regprocedure)` etc.
--
-- Units: every item has one base unit (g, mL or pc). kg = 1,000 g and L = 1,000 mL are built in;
-- packs, rolls and boxes only through a conversion set for that item. Mass and volume are never
-- converted into each other. Lines may be sent as {item_id, qty, unit}; the server converts them
-- and keeps what was typed as "entered".
--
-- Negative stock: an issue larger than what is on hand is saved, and its stock move is flagged
-- provisional (its cost is the cost on record, not yet confirmed by a receipt). A negative balance
-- has no value in stock_on_hand, and averages are only recomputed from a positive quantity.
--
-- Batches: a production record may carry only its output ("materials": "pending"). Materials are
-- added later with add_batch_consumption() as separate USE- records linked to the batch (never
-- adding the output again; retries return the same entry; an identical entry is refused).
-- complete_batch() closes it and records the batch cost as complete, provisional or unknown. A
-- material entry is corrected by reversing it, which reopens the batch.

create or replace function private.unit_factor(p_item uuid, p_unit text) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare b text; f numeric;
begin
  select base_unit into b from public.stock_items where id = p_item;
  if b is null then perform private.fail('unknown_item'); end if;
  if p_unit is null or p_unit = b then return 1; end if;
  if b = 'g' and p_unit = 'kg' then return 1000; end if;
  if b = 'mL' and p_unit = 'L' then return 1000; end if;
  select factor into f from public.unit_conversions where item_id = p_item and unit = p_unit;
  if f is null then perform private.fail('unit_invalid', jsonb_build_object('unit', p_unit, 'base_unit', b)); end if;
  return f;
end $$;

create or replace function private.normalise_lines(p_lines jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(case when e ? 'unit' and coalesce(e ->> 'item_id', '') <> '' then
      (e - 'unit') || jsonb_build_object(
        'qty', (e ->> 'qty')::numeric * private.unit_factor((e ->> 'item_id')::uuid, e ->> 'unit'),
        'entered', jsonb_build_object('qty', (e ->> 'qty')::numeric, 'unit', e ->> 'unit'))
    else e end order by ord), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality x(e, ord)
$$;

alter table public.stock_moves add column provisional boolean not null default false;
comment on column public.stock_moves.provisional is 'True when stock went below zero: the issue used the cost on record at the time, which is not yet confirmed by a receipt.';

create or replace function private.move(
  p_date date, p_item uuid, p_location text, p_qty numeric, p_kind text,
  p_doc_type text, p_doc_id uuid, p_unit_cost numeric default null, p_reverses bigint default null
) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  c public.item_costs;
  cost numeric;
  have numeric;
  short boolean := false;
begin
  perform private.assert_open(p_date);
  insert into public.item_costs (item_id) values (p_item) on conflict do nothing;
  select * into c from public.item_costs where item_id = p_item for update;

  if p_qty < 0 then
    have := public.on_hand(p_item, p_location);
    short := have + p_qty < 0;
    if p_unit_cost is not null then
      -- Reversing a costed receipt: take its own cost back out of the average.
      cost := p_unit_cost;
      if c.qty + p_qty > 0 and c.avg_cost is not null and c.qty > 0 then
        update public.item_costs set avg_cost = greatest(0, (c.qty * c.avg_cost + p_qty * p_unit_cost) / (c.qty + p_qty)) where item_id = p_item;
      end if;
    else
      cost := c.avg_cost;
    end if;
  elsif p_unit_cost is not null then
    cost := p_unit_cost;
    update public.item_costs set avg_cost = case
        when c.avg_cost is null or c.qty <= 0 then p_unit_cost
        else (c.qty * c.avg_cost + p_qty * p_unit_cost) / (c.qty + p_qty) end
      where item_id = p_item;
  else
    cost := c.avg_cost;
  end if;

  update public.item_costs set qty = qty + p_qty where item_id = p_item;
  insert into public.stock_moves (move_date, item_id, location_code, qty, unit_cost, kind, doc_type, doc_id, reverses, created_by, provisional)
  values (p_date, p_item, p_location, p_qty, cost, p_kind, p_doc_type, p_doc_id, p_reverses, private.member_id(), short);
  return cost;
end $$;

create or replace view public.stock_on_hand with (security_invoker = true) as
select m.item_id, i.code, i.name_en, i.name_th, i.kind, i.base_unit, m.location_code,
  sum(m.qty) as qty,
  c.avg_cost,
  case when c.avg_cost is null or sum(m.qty) <= 0 then null else round(sum(m.qty) * c.avg_cost, 2) end as value,
  i.min_level,
  sum(m.qty) < 0 as negative,
  i.category_code
from public.stock_moves m
join public.stock_items i on i.id = m.item_id
left join public.item_costs c on c.item_id = m.item_id
group by m.item_id, i.code, i.name_en, i.name_th, i.kind, i.base_unit, m.location_code, c.avg_cost, i.min_level, i.category_code
having sum(m.qty) <> 0;

revoke all on function private.unit_factor(uuid, text), private.normalise_lines(jsonb) from public, anon, authenticated;

alter table public.documents drop constraint documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check check (doc_type in
  ('purchase', 'expense', 'production', 'transfer', 'count', 'sale', 'consignment', 'payment', 'partner', 'opening', 'adjustment', 'consumption'));

alter table public.documents add column updated_at timestamptz not null default now();
alter table public.documents add column updated_by uuid references public.members (id);
create or replace function private.touch_document() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := private.member_id();
  return new;
end $$;
create trigger touch_document before update on public.documents for each row execute function private.touch_document();

create or replace function private.next_doc_no(p_type text, p_date date) returns text
language plpgsql security definer set search_path = '' as $$
declare
  y integer := extract(year from p_date);
  k integer;
  prefix text := case p_type
    when 'purchase' then 'PUR' when 'expense' then 'EXP' when 'production' then 'PRD'
    when 'transfer' then 'TRF' when 'count' then 'CNT' when 'sale' then 'SAL'
    when 'consignment' then 'CON' when 'payment' then 'PAY' when 'partner' then 'PTN'
    when 'adjustment' then 'ADJ' when 'consumption' then 'USE' else 'OPN' end;
begin
  insert into private.doc_counters (doc_type, year, n) values (p_type, y, 1)
    on conflict (doc_type, year) do update set n = private.doc_counters.n + 1
    returning n into k;
  return prefix || '-' || y || '-' || lpad(k::text, 5, '0');
end $$;

-- Existing batches recorded their materials together with the output: they are complete.
update public.documents d set data = d.data || '{"materials": "complete"}'::jsonb
where d.doc_type = 'production' and not d.data ? 'materials'
  and exists (select 1 from public.doc_lines l where l.doc_id = d.id and l.extra ->> 'dir' = 'in');

revoke all on function private.touch_document() from public, anon, authenticated;

create or replace function private.apply_effects(p_doc uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.documents;
  l record;
  ship numeric;
  sub numeric;
  in_cost numeric := 0;
  cost_known boolean := true;
  has_in boolean;
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
    -- Output can be recorded before its materials ("materials pending"): it then enters stock with
    -- an unknown cost (never zero) until complete_batch() works out the batch cost.
    has_in := exists (select 1 from public.doc_lines where doc_id = d.id and extra ->> 'dir' = 'in');
    for l in select * from public.doc_lines where doc_id = d.id and extra ->> 'dir' = 'in' order by line_no loop
      c := private.move(d.doc_date, l.item_id, d.location_code, -l.qty, 'production_in', 'production', d.id);
      if c is null then cost_known := false; else in_cost := in_cost + c * l.qty; end if;
    end loop;
    select * into out_line from public.doc_lines where doc_id = d.id and extra ->> 'dir' = 'out';
    perform private.move(d.doc_date, out_line.item_id, d.location_code, out_line.qty, 'production_out', 'production', d.id,
      case when has_in and cost_known and out_line.qty > 0 then in_cost / out_line.qty end);

  elsif d.doc_type = 'consumption' then
    for l in select * from public.doc_lines where doc_id = d.id order by line_no loop
      perform private.move(d.doc_date, l.item_id, d.location_code, -l.qty, 'production_in', 'consumption', d.id);
    end loop;

  elsif d.doc_type = 'adjustment' then
    for l in select * from public.doc_lines where doc_id = d.id order by line_no loop
      perform private.move(d.doc_date, l.item_id, d.location_code, l.qty, 'adjustment', 'adjustment', d.id);
    end loop;

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
    else
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

create or replace function public.post_document(p jsonb) returns public.documents
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  me uuid := private.member_id();
  my_role text := private.member_role();
  existing public.documents;
  d public.documents;
  t text := p ->> 'doc_type';
  dt date := (p ->> 'doc_date')::date;
  loc text := nullif(p ->> 'location_code', '');
  data jsonb := coalesce(p -> 'data', '{}'::jsonb);
  lines jsonb;
  l jsonb;
  i integer := 0;
  tot numeric := 0;
  needs boolean := false;
  lim numeric;
  ins integer;
  outs integer;
  g_in numeric;
  r_out numeric;
  loss numeric;
  diff numeric;
  gp numeric;
  rec_doc public.documents;
begin
  perform private.require(me is not null, 'not_member');
  perform private.require((p ->> 'client_key') is not null, 'client_key_required');

  -- A retried submission returns the record it already created.
  select * into existing from public.documents where client_key = (p ->> 'client_key')::uuid;
  if found then return existing; end if;

  perform private.assert_open(dt);
  perform private.require(t in ('purchase', 'expense', 'production', 'transfer', 'count', 'sale', 'consignment', 'payment', 'partner', 'opening', 'adjustment'), 'unknown_type');
  if my_role = 'staff' then
    perform private.require(t in ('production', 'transfer', 'count', 'sale', 'adjustment'), 'not_allowed');
  end if;
  if t not in ('expense', 'payment', 'partner', 'opening') then
    perform private.require(exists (select 1 from public.locations where code = loc and active and kind <> 'transit'), 'location_required');
  end if;

  -- Entered units (kg, L, packs...) become base units; incompatible units are refused.
  lines := private.normalise_lines(p -> 'lines');

  for l in select * from jsonb_array_elements(lines) loop
    if t not in ('opening') or l ->> 'kind' = 'stock' then
      perform private.require(private.item_kind((l ->> 'item_id')::uuid) is not null, 'unknown_item');
      if t = 'adjustment' then
        perform private.require(coalesce((l ->> 'qty')::numeric, 0) <> 0, 'qty_nonzero');
      else
        perform private.require(coalesce((l ->> 'qty')::numeric, -1) >= case when t = 'count' then 0 else 0.001 end, 'qty_positive');
      end if;
    end if;
  end loop;

  if t = 'purchase' then
    perform private.require(jsonb_array_length(lines) > 0, 'lines_required');
    perform private.require(coalesce(data ->> 'supplier', '') <> '', 'supplier_required');
    perform private.check_paid(data ->> 'paid');
    for l in select * from jsonb_array_elements(lines) loop
      perform private.require(coalesce((l ->> 'amount')::numeric, -1) >= 0, 'amount_required');
      tot := tot + (l ->> 'amount')::numeric;
    end loop;
    tot := tot + coalesce((data ->> 'shipping')::numeric, 0);
  elsif t = 'expense' then
    perform private.require(coalesce(data ->> 'category', '') <> '', 'category_required');
    perform private.check_paid(data ->> 'paid');
    tot := (p ->> 'total')::numeric;
    perform private.require(tot > 0, 'amount_required');
  elsif t = 'production' then
    perform private.require(data ->> 'kind' in ('roast', 'pack', 'brew'), 'production_kind');
    select count(*) filter (where e ->> 'dir' = 'in'), count(*) filter (where e ->> 'dir' = 'out')
      into ins, outs from jsonb_array_elements(lines) e;
    perform private.require(outs = 1, 'production_lines');
    -- Output first: materials can be added later with add_batch_consumption().
    data := data || jsonb_build_object('materials', case when ins = 0 then 'pending' else 'complete' end);
    if data ->> 'kind' = 'roast' then
      perform private.require((select private.item_kind((e ->> 'item_id')::uuid) from jsonb_array_elements(lines) e where e ->> 'dir' = 'out') = 'roasted_bean', 'roast_makes_roasted');
      if ins > 0 then
        perform private.require(ins = 1, 'roast_one_bean');
        select (e ->> 'qty')::numeric into g_in from jsonb_array_elements(lines) e where e ->> 'dir' = 'in';
        select (e ->> 'qty')::numeric into r_out from jsonb_array_elements(lines) e where e ->> 'dir' = 'out';
        perform private.require((select private.item_kind((e ->> 'item_id')::uuid) from jsonb_array_elements(lines) e where e ->> 'dir' = 'in') = 'green_bean', 'roast_needs_green');
        perform private.require(r_out < g_in, 'roast_out_less');
        loss := round((g_in - r_out) / g_in * 100, 2);
        data := data || jsonb_build_object('roast_loss_pct', loss);
        needs := private.setting('roast_loss_min_pct') is null or private.setting('roast_loss_max_pct') is null
          or loss < private.setting('roast_loss_min_pct') or loss > private.setting('roast_loss_max_pct');
      end if;
    else
      perform private.require((select private.item_kind((e ->> 'item_id')::uuid) from jsonb_array_elements(lines) e where e ->> 'dir' = 'out') = 'product', 'production_makes_product');
      if exists (select 1 from jsonb_array_elements(lines) e where e ->> 'dir' = 'in' and private.item_kind((e ->> 'item_id')::uuid) = 'green_bean') then
        data := data || jsonb_build_object('warnings', jsonb_build_array('green_beans_in_' || (data ->> 'kind')));
      end if;
    end if;
  elsif t = 'adjustment' then
    -- Signed stock correction: needs a reason and the owner's approval (unless the owner records it).
    perform private.require(jsonb_array_length(lines) > 0, 'lines_required');
    perform private.require(coalesce(btrim(data ->> 'reason'), '') <> '', 'reason_required');
    needs := true;
  elsif t = 'transfer' then
    perform private.require(jsonb_array_length(lines) > 0, 'lines_required');
    perform private.require(exists (select 1 from public.locations where code = data ->> 'to' and kind <> 'transit' and active), 'location_required');
    perform private.require(data ->> 'to' <> loc, 'transfer_same_location');
  elsif t = 'count' then
    perform private.require(jsonb_array_length(lines) > 0, 'lines_required');
    lim := private.setting('count_tolerance_units');
    for l in select * from jsonb_array_elements(lines) loop
      diff := (l ->> 'qty')::numeric - public.on_hand((l ->> 'item_id')::uuid, loc);
      if diff <> 0 and (lim is null or abs(diff) > lim) then needs := true; end if;
    end loop;
  elsif t = 'sale' then
    perform private.require(jsonb_array_length(lines) > 0, 'lines_required');
    perform private.require(exists (select 1 from public.channels where code = data ->> 'channel' and active and kind <> 'consignment'), 'channel_required');
    perform private.require(data ->> 'paid' in ('payout', 'unpaid') or exists (select 1 from public.accounts where code = data ->> 'paid' and active), 'unknown_account');
    if coalesce(data ->> 'order_ref', '') <> '' then
      perform private.require(not exists (select 1 from public.documents x where x.doc_type = 'sale' and x.status in ('pending', 'posted')
        and x.data ->> 'channel' = data ->> 'channel' and x.data ->> 'order_ref' = data ->> 'order_ref'), 'duplicate_order', jsonb_build_object('order_ref', data ->> 'order_ref'));
    end if;
    for l in select * from jsonb_array_elements(lines) loop
      perform private.require(private.item_kind((l ->> 'item_id')::uuid) = 'product', 'sale_needs_product');
      perform private.require(coalesce((l ->> 'unit_price')::numeric, -1) >= 0, 'price_required');
      tot := tot + round((l ->> 'qty')::numeric * (l ->> 'unit_price')::numeric - coalesce((l ->> 'discount')::numeric, 0), 2);
    end loop;
  elsif t = 'consignment' then
    perform private.require(exists (select 1 from public.locations where code = loc and kind = 'consignment'), 'consignment_location');
    perform private.require(exists (select 1 from public.channels where code = data ->> 'channel' and kind = 'consignment' and active), 'channel_required');
    perform private.require(coalesce(data ->> 'report_no', '') <> '', 'report_no_required');
    perform private.require(not exists (select 1 from public.documents x where x.doc_type = 'consignment' and x.status in ('pending', 'posted')
      and x.data ->> 'report_no' = data ->> 'report_no'), 'duplicate_report', jsonb_build_object('report_no', data ->> 'report_no'));
    gp := (data ->> 'gp_percent')::numeric;
    perform private.require(gp between 0 and 100, 'gp_required');
    for l in select * from jsonb_array_elements(lines) loop
      perform private.require(private.item_kind((l ->> 'item_id')::uuid) = 'product', 'sale_needs_product');
      perform private.require(coalesce((l ->> 'amount')::numeric, -1) >= 0, 'amount_required');
      tot := tot + (l ->> 'amount')::numeric;
    end loop;
    if (data ->> 'report_total') is not null then
      perform private.require(round(tot, 2) = round((data ->> 'report_total')::numeric, 2), 'report_total_mismatch',
        jsonb_build_object('lines', tot, 'report', data ->> 'report_total'));
    end if;
    data := data || jsonb_build_object(
      'gp_amount', round(tot * gp / 100, 2),
      'amount_due', round(tot * (1 - gp / 100), 2),
      'due_date', dt + coalesce((select settles_days from public.channels where code = data ->> 'channel'), 30));
    needs := true;
  elsif t = 'payment' then
    tot := (p ->> 'total')::numeric;
    perform private.require(tot > 0, 'amount_required');
    perform private.require(data ->> 'direction' in ('in', 'out'), 'payment_direction');
    select * into rec_doc from public.documents where id = (data ->> 'for_doc')::uuid and status = 'posted';
    perform private.require(found, 'payment_needs_record');
    if data ->> 'direction' = 'in' then
      perform private.require(rec_doc.doc_type in ('sale', 'consignment'), 'payment_needs_record');
      perform private.require(exists (select 1 from public.accounts where code = data ->> 'account' and active), 'unknown_account');
    else
      perform private.require(rec_doc.doc_type in ('purchase', 'expense') and rec_doc.data ->> 'paid' = 'unpaid', 'payment_needs_record');
      perform private.check_paid(data ->> 'paid');
      perform private.require(data ->> 'paid' <> 'unpaid', 'unknown_account');
    end if;
    needs := true;
  elsif t = 'partner' then
    perform private.require(data ->> 'kind' in ('contribution', 'drawing', 'reimbursed'), 'partner_kind');
    perform private.require(exists (select 1 from public.members where id = (data ->> 'member')::uuid and role in ('owner', 'partner')), 'unknown_member');
    perform private.require(exists (select 1 from public.accounts where code = data ->> 'account' and active), 'unknown_account');
    tot := (p ->> 'total')::numeric;
    perform private.require(tot > 0, 'amount_required');
    needs := true;
  elsif t = 'opening' then
    perform private.require(jsonb_array_length(lines) > 0, 'lines_required');
    needs := true;
  end if;

  if t in ('purchase', 'expense') then
    perform private.require(coalesce(jsonb_array_length(p -> 'attachments'), 0) > 0 or coalesce(data ->> 'no_receipt_reason', '') <> '', 'receipt_or_reason');
    lim := private.setting(case t when 'purchase' then 'purchase_approval_over' else 'expense_approval_over' end);
    needs := (data ->> 'no_receipt_reason') is not null or lim is null or tot > lim;
  end if;

  -- The owner's own records post at once.
  if my_role = 'owner' then needs := false; end if;

  insert into public.documents (doc_no, doc_type, doc_date, location_code, status, total, data, note, attachments,
    needs_approval, approved_by, approved_at, client_key, created_by)
  values (private.next_doc_no(t, dt), t, dt, loc, case when needs then 'pending' else 'posted' end,
    case when t in ('production', 'transfer', 'count', 'adjustment') then null else tot end, data, nullif(p ->> 'note', ''),
    coalesce(array(select jsonb_array_elements_text(p -> 'attachments')), '{}'),
    needs, case when not needs then me end, case when not needs then now() end,
    (p ->> 'client_key')::uuid, me)
  returning * into d;

  for l in select * from jsonb_array_elements(lines) loop
    i := i + 1;
    insert into public.doc_lines (doc_id, line_no, item_id, qty, unit_price, amount, extra)
    values (d.id, i, (l ->> 'item_id')::uuid, (l ->> 'qty')::numeric, (l ->> 'unit_price')::numeric,
      coalesce((l ->> 'amount')::numeric, case when (l ->> 'unit_price') is not null
        then round((l ->> 'qty')::numeric * (l ->> 'unit_price')::numeric - coalesce((l ->> 'discount')::numeric, 0), 2) end),
      l - 'item_id' - 'qty' - 'unit_price' - 'amount');
  end loop;

  if d.status = 'posted' then perform private.apply_effects(d.id); end if;
  return d;
end $$;

create or replace function public.add_batch_consumption(p jsonb) returns public.documents
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  me uuid := private.member_id();
  b public.documents;
  d public.documents;
  lines jsonb;
  l jsonb;
  i integer := 0;
  dt date;
  warn jsonb := '[]'::jsonb;
begin
  perform private.require(me is not null, 'not_member');
  perform private.require((p ->> 'client_key') is not null, 'client_key_required');
  select * into d from public.documents where client_key = (p ->> 'client_key')::uuid;
  if found then return d; end if;

  select * into b from public.documents where id = (p ->> 'batch_id')::uuid and doc_type = 'production' for update;
  perform private.require(found and b.status = 'posted' and b.reverses_doc is null, 'batch_not_open');
  perform private.require(coalesce(b.data ->> 'materials', 'complete') = 'pending', 'batch_complete');

  lines := private.normalise_lines(p -> 'lines');
  perform private.require(jsonb_array_length(lines) > 0, 'lines_required');
  for l in select * from jsonb_array_elements(lines) loop
    perform private.require(private.item_kind((l ->> 'item_id')::uuid) is not null, 'unknown_item');
    perform private.require(private.item_kind((l ->> 'item_id')::uuid) <> 'product', 'consumption_not_product');
    perform private.require(coalesce((l ->> 'qty')::numeric, -1) > 0, 'qty_positive');
    if b.data ->> 'kind' in ('brew', 'pack') and private.item_kind((l ->> 'item_id')::uuid) = 'green_bean' then
      warn := jsonb_build_array('green_beans_in_' || (b.data ->> 'kind'));
    end if;
  end loop;

  perform private.require(not exists (
    select 1 from public.documents x
    where x.doc_type = 'consumption' and x.status = 'posted' and x.reverses_doc is null and x.data ->> 'batch_id' = b.id::text
      and (select jsonb_agg(jsonb_build_array(item_id, qty) order by item_id, qty) from public.doc_lines where doc_id = x.id)
        = (select jsonb_agg(jsonb_build_array((e ->> 'item_id')::uuid, round((e ->> 'qty')::numeric, 3)) order by (e ->> 'item_id')::uuid, round((e ->> 'qty')::numeric, 3))
           from jsonb_array_elements(lines) e)), 'duplicate_consumption');

  dt := coalesce((p ->> 'doc_date')::date, b.doc_date);
  perform private.assert_open(dt);
  insert into public.documents (doc_no, doc_type, doc_date, location_code, status, total, data, note, needs_approval,
    approved_by, approved_at, client_key, created_by)
  values (private.next_doc_no('consumption', dt), 'consumption', dt, b.location_code, 'posted', null,
    jsonb_build_object('batch_id', b.id, 'batch_no', b.doc_no, 'kind', b.data ->> 'kind')
      || case when jsonb_array_length(warn) > 0 then jsonb_build_object('warnings', warn) else '{}'::jsonb end,
    nullif(p ->> 'note', ''), false, me, now(), (p ->> 'client_key')::uuid, me)
  returning * into d;

  for l in select * from jsonb_array_elements(lines) loop
    i := i + 1;
    insert into public.doc_lines (doc_id, line_no, item_id, qty, extra)
    values (d.id, i, (l ->> 'item_id')::uuid, (l ->> 'qty')::numeric,
      (l - 'item_id' - 'qty' - 'unit_price' - 'amount') || jsonb_build_object('dir', 'in'));
  end loop;
  perform private.apply_effects(d.id);
  perform private.log('add_consumption', 'documents', b.id::text, d.doc_no);
  return d;
end $$;

create or replace function public.complete_batch(p_id uuid, p_note text default null) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare
  b public.documents;
  out_line public.doc_lines;
  cost numeric;
  unknown integer;
  prov boolean;
  green numeric;
  unit numeric;
  cost_state text;
begin
  perform private.require(private.member_id() is not null, 'not_member');
  select * into b from public.documents where id = p_id and doc_type = 'production' for update;
  perform private.require(found and b.status = 'posted' and b.reverses_doc is null, 'batch_not_open');
  perform private.require(coalesce(b.data ->> 'materials', 'complete') = 'pending', 'batch_complete');
  perform private.require(exists (select 1 from public.documents x where x.doc_type = 'consumption' and x.status = 'posted'
    and x.reverses_doc is null and x.data ->> 'batch_id' = b.id::text), 'consumption_required');

  select coalesce(-sum(m.value) filter (where m.unit_cost is not null), 0), count(*) filter (where m.unit_cost is null), coalesce(bool_or(m.provisional), false),
         coalesce(-sum(m.qty) filter (where i.kind = 'green_bean'), 0)
    into cost, unknown, prov, green
  from public.stock_moves m
  join public.documents x on x.id = m.doc_id
  join public.stock_items i on i.id = m.item_id
  where x.doc_type = 'consumption' and x.status = 'posted' and x.reverses_doc is null and x.data ->> 'batch_id' = b.id::text
    and m.reverses is null and not exists (select 1 from public.stock_moves r where r.reverses = m.id);

  select * into out_line from public.doc_lines where doc_id = b.id and extra ->> 'dir' = 'out';
  cost_state := case when unknown > 0 then 'unknown' when prov then 'provisional' else 'complete' end;
  unit := case when unknown = 0 and out_line.qty > 0 then round(cost / out_line.qty, 6) end;

  if unit is not null then
    update public.item_costs set avg_cost = case
        when avg_cost is null then unit
        when qty > 0 then greatest(0, avg_cost + out_line.qty * (unit - avg_cost) / qty)
        else avg_cost end
    where item_id = out_line.item_id;
  end if;

  update public.documents set data = data || jsonb_build_object(
      'materials', 'complete', 'cost_status', cost_state,
      'batch_cost', case when unknown = 0 then round(cost, 2) end, 'unit_cost', unit,
      'completed_at', now(), 'completed_by', private.member_id())
    || case when b.data ->> 'kind' = 'roast' and green > 0
         then jsonb_build_object('roast_loss_pct', round((green - out_line.qty) / green * 100, 2)) else '{}'::jsonb end
  where id = b.id returning * into b;
  perform private.log('complete_batch', 'documents', b.id::text, p_note, jsonb_build_object('cost_status', cost_state, 'batch_cost', b.data -> 'batch_cost'));
  return b;
end $$;

revoke all on function public.add_batch_consumption(jsonb), public.complete_batch(uuid, text) from public, anon;
grant execute on function public.add_batch_consumption(jsonb), public.complete_batch(uuid, text) to authenticated;

create or replace function public.reverse_document(p_id uuid, p_date date, p_reason text) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare
  d public.documents;
  r public.documents;
  m record;
begin
  perform private.require(private.member_id() is not null, 'not_member');
  perform private.require(coalesce(p_reason, '') <> '', 'reason_required');
  select * into d from public.documents where id = p_id for update;
  perform private.require(found and d.status = 'posted' and d.reverses_doc is null, 'not_reversible');
  perform private.require(private.is_owner() or (d.created_by = private.member_id() and not d.needs_approval), 'owner_only');
  -- A batch's material entries are reversed first, so its history stays complete.
  if d.doc_type = 'production' then
    perform private.require(not exists (select 1 from public.documents x where x.doc_type = 'consumption' and x.status = 'posted'
      and x.reverses_doc is null and x.data ->> 'batch_id' = d.id::text), 'batch_has_consumption');
  end if;

  insert into public.documents (doc_no, doc_type, doc_date, location_code, status, total, data, note, needs_approval,
    approved_by, approved_at, reverses_doc, client_key, created_by)
  values (private.next_doc_no(d.doc_type, p_date), d.doc_type, p_date, d.location_code, 'posted',
    case when d.total is null then null else -d.total end,
    jsonb_build_object('reversal_of', d.doc_no) || case when d.doc_type = 'consumption' then jsonb_build_object('batch_id', d.data -> 'batch_id') else '{}'::jsonb end,
    p_reason, false, private.member_id(), now(), d.id, gen_random_uuid(), private.member_id())
  returning * into r;

  for m in select * from public.stock_moves where doc_id = d.id and reverses is null order by id desc loop
    perform private.move(p_date, m.item_id, m.location_code, -m.qty, m.kind || '_reversed', d.doc_type, r.id,
      case when m.qty > 0 or m.unit_cost is not null then m.unit_cost end, m.id);
  end loop;
  for m in select * from public.money_moves where doc_id = d.id and reverses is null loop
    perform private.money(p_date, m.account_code, -m.amount, m.kind || '_reversed', d.doc_type, r.id, m.id);
  end loop;
  for m in select * from public.partner_moves where doc_id = d.id and reverses is null loop
    perform private.partner(p_date, m.member_id, -m.amount, m.kind, d.doc_type, r.id, m.id);
  end loop;

  update public.documents set status = 'reversed', reversed_by_doc = r.id where id = d.id returning * into d;
  perform private.log('reverse', 'documents', p_id::text, p_reason);

  -- Reversing a material entry reopens its batch for correction.
  if d.doc_type = 'consumption' then
    update public.documents set data = (data - 'batch_cost' - 'unit_cost' - 'cost_status' - 'completed_at' - 'completed_by')
        || '{"materials": "pending"}'::jsonb
    where id = (d.data ->> 'batch_id')::uuid and data ->> 'materials' = 'complete';
    if found then perform private.log('reopen_batch', 'documents', d.data ->> 'batch_id', p_reason); end if;
  end if;
  return r;
end $$;
