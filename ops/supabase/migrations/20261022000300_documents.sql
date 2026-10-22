-- Balena operations: documents (every business record) and the functions that post them.
--
-- One header table holds every record type; lines hold its items. The browser never writes these
-- tables directly: it calls post_document(), which checks the record, decides whether it needs the
-- owner's approval, and (once approved) writes the stock, money and partner ledger rows. A mistake
-- is fixed with reverse_document(), which adds a linked reversal and keeps the original visible.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  doc_type text not null check (doc_type in
    ('purchase', 'expense', 'production', 'transfer', 'count', 'sale', 'consignment', 'payment', 'partner', 'opening')),
  doc_date date not null,
  location_code text references public.locations (code),
  status text not null check (status in ('pending', 'posted', 'rejected', 'reversed')),
  total numeric(14,2),
  data jsonb not null default '{}'::jsonb,
  note text,
  attachments text[] not null default '{}',
  needs_approval boolean not null default false,
  approved_by uuid references public.members (id),
  approved_at timestamptz,
  decision_note text,
  reverses_doc uuid references public.documents (id),
  reversed_by_doc uuid references public.documents (id),
  disputed boolean not null default false,
  dispute_note text,
  client_key uuid not null unique,
  created_by uuid not null references public.members (id),
  created_at timestamptz not null default now()
);
create index documents_type_date on public.documents (doc_type, doc_date desc);
create index documents_status on public.documents (status) where status = 'pending';

create table public.doc_lines (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.documents (id),
  line_no integer not null,
  item_id uuid references public.stock_items (id),
  qty numeric(14,3),
  unit_price numeric(14,4),
  amount numeric(14,2),
  extra jsonb not null default '{}'::jsonb,
  unique (doc_id, line_no)
);

create trigger audit after insert or update on public.documents for each row execute function private.audit();

create table private.doc_counters (doc_type text, year integer, n integer not null default 0, primary key (doc_type, year));

create or replace function private.next_doc_no(p_type text, p_date date) returns text
language plpgsql security definer set search_path = '' as $$
declare
  y integer := extract(year from p_date);
  k integer;
  prefix text := case p_type
    when 'purchase' then 'PUR' when 'expense' then 'EXP' when 'production' then 'PRD'
    when 'transfer' then 'TRF' when 'count' then 'CNT' when 'sale' then 'SAL'
    when 'consignment' then 'CON' when 'payment' then 'PAY' when 'partner' then 'PTN' else 'OPN' end;
begin
  insert into private.doc_counters (doc_type, year, n) values (p_type, y, 1)
    on conflict (doc_type, year) do update set n = private.doc_counters.n + 1
    returning n into k;
  return prefix || '-' || y || '-' || lpad(k::text, 5, '0');
end $$;

create or replace function private.setting(p_key text) returns numeric
language sql stable security definer set search_path = '' as $$
  select value from public.settings where key = p_key
$$;

-- ---------- validation helpers ----------

create or replace function private.require(p_ok boolean, p_key text, p_detail jsonb default '{}'::jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  if p_ok is not true then perform private.fail(p_key, p_detail); end if;
end $$;

create or replace function private.item_kind(p_item uuid) returns text
language sql stable security definer set search_path = '' as $$
  select kind from public.stock_items where id = p_item and active
$$;

-- "paid" is an account code, 'member:<uuid>' (a partner paid personally) or 'unpaid'.
create or replace function private.check_paid(p_paid text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_paid = 'unpaid' then return; end if;
  if p_paid like 'member:%' then
    perform private.require(exists (select 1 from public.members where id = substr(p_paid, 8)::uuid and active), 'unknown_member');
    return;
  end if;
  perform private.require(exists (select 1 from public.accounts where code = p_paid and active), 'unknown_account', jsonb_build_object('account', p_paid));
end $$;

-- ---------- effects: what a posted document does to the ledgers ----------

create or replace function private.pay_effect(d public.documents, p_amount numeric, p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare paid text := d.data ->> 'paid';
begin
  if paid is null or paid = 'unpaid' or p_amount = 0 then return; end if;
  if paid like 'member:%' then
    perform private.partner(d.doc_date, substr(paid, 8)::uuid, p_amount, 'paid_for_business', d.doc_type, d.id);
  else
    perform private.money(d.doc_date, paid, -p_amount, p_kind, d.doc_type, d.id);
  end if;
end $$;

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
    for l in select * from public.doc_lines where doc_id = d.id order by line_no loop
      perform private.move(d.doc_date, l.item_id, d.location_code, -l.qty, 'sale', 'consignment', d.id);
    end loop;

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

-- ---------- posting ----------

create or replace function public.post_document(p jsonb) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.member_id();
  my_role text := private.member_role();
  existing public.documents;
  d public.documents;
  t text := p ->> 'doc_type';
  dt date := (p ->> 'doc_date')::date;
  loc text := nullif(p ->> 'location_code', '');
  data jsonb := coalesce(p -> 'data', '{}'::jsonb);
  lines jsonb := coalesce(p -> 'lines', '[]'::jsonb);
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
  perform private.require(t in ('purchase', 'expense', 'production', 'transfer', 'count', 'sale', 'consignment', 'payment', 'partner', 'opening'), 'unknown_type');
  if my_role = 'staff' then
    perform private.require(t in ('production', 'transfer', 'count', 'sale'), 'not_allowed');
  end if;
  if t not in ('expense', 'payment', 'partner', 'opening') then
    perform private.require(exists (select 1 from public.locations where code = loc and active and kind <> 'transit'), 'location_required');
  end if;

  -- lines: item, qty and amount checks shared by most types
  for l in select * from jsonb_array_elements(lines) loop
    if t not in ('opening') or l ->> 'kind' = 'stock' then
      perform private.require(private.item_kind((l ->> 'item_id')::uuid) is not null, 'unknown_item');
      perform private.require(coalesce((l ->> 'qty')::numeric, -1) >= case when t = 'count' then 0 else 0.001 end, 'qty_positive');
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
    perform private.require(ins >= 1 and outs = 1, 'production_lines');
    if data ->> 'kind' = 'roast' then
      perform private.require(ins = 1, 'roast_one_bean');
      select (e ->> 'qty')::numeric into g_in from jsonb_array_elements(lines) e where e ->> 'dir' = 'in';
      select (e ->> 'qty')::numeric into r_out from jsonb_array_elements(lines) e where e ->> 'dir' = 'out';
      perform private.require((select private.item_kind((e ->> 'item_id')::uuid) from jsonb_array_elements(lines) e where e ->> 'dir' = 'in') = 'green_bean', 'roast_needs_green');
      perform private.require((select private.item_kind((e ->> 'item_id')::uuid) from jsonb_array_elements(lines) e where e ->> 'dir' = 'out') = 'roasted_bean', 'roast_makes_roasted');
      perform private.require(r_out < g_in, 'roast_out_less');
      loss := round((g_in - r_out) / g_in * 100, 2);
      data := data || jsonb_build_object('roast_loss_pct', loss);
      needs := private.setting('roast_loss_min_pct') is null or private.setting('roast_loss_max_pct') is null
        or loss < private.setting('roast_loss_min_pct') or loss > private.setting('roast_loss_max_pct');
    else
      perform private.require((select private.item_kind((e ->> 'item_id')::uuid) from jsonb_array_elements(lines) e where e ->> 'dir' = 'out') = 'product', 'production_makes_product');
    end if;
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

  -- purchases and expenses: receipt or reason; approval above the agreed limit
  if t in ('purchase', 'expense') then
    perform private.require(coalesce(jsonb_array_length(p -> 'attachments'), 0) > 0 or coalesce(data ->> 'no_receipt_reason', '') <> '', 'receipt_or_reason');
    lim := private.setting(case t when 'purchase' then 'purchase_approval_over' else 'expense_approval_over' end);
    needs := (data ->> 'no_receipt_reason') is not null or lim is null or tot > lim;
  end if;

  -- The owner's own records post at once; partners see them in the activity feed.
  if my_role = 'owner' then needs := false; end if;

  insert into public.documents (doc_no, doc_type, doc_date, location_code, status, total, data, note, attachments,
    needs_approval, approved_by, approved_at, client_key, created_by)
  values (private.next_doc_no(t, dt), t, dt, loc, case when needs then 'pending' else 'posted' end,
    case when t in ('production', 'transfer', 'count') then null else tot end, data, nullif(p ->> 'note', ''),
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

-- ---------- approve / reject ----------

create or replace function public.decide_document(p_id uuid, p_approve boolean, p_note text default null) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare d public.documents;
begin
  perform private.require(private.is_owner(), 'owner_only');
  select * into d from public.documents where id = p_id for update;
  perform private.require(found and d.status = 'pending', 'not_pending');
  if p_approve then
    perform private.assert_open(d.doc_date);
    update public.documents set status = 'posted', approved_by = private.member_id(), approved_at = now(), decision_note = p_note where id = p_id returning * into d;
    perform private.apply_effects(p_id);
    perform private.log('approve', 'documents', p_id::text, p_note);
  else
    perform private.require(coalesce(p_note, '') <> '', 'reason_required');
    update public.documents set status = 'rejected', approved_by = private.member_id(), approved_at = now(), decision_note = p_note where id = p_id returning * into d;
    perform private.log('reject', 'documents', p_id::text, p_note);
  end if;
  return d;
end $$;

-- ---------- receive a transfer (partial receipts allowed, differences need a reason) ----------

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

-- ---------- reverse (never delete) ----------

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

  insert into public.documents (doc_no, doc_type, doc_date, location_code, status, total, data, note, needs_approval,
    approved_by, approved_at, reverses_doc, client_key, created_by)
  values (private.next_doc_no(d.doc_type, p_date), d.doc_type, p_date, d.location_code, 'posted',
    case when d.total is null then null else -d.total end, jsonb_build_object('reversal_of', d.doc_no), p_reason, false,
    private.member_id(), now(), d.id, gen_random_uuid(), private.member_id())
  returning * into r;

  -- Undo stock in reverse order, so stock moved on is taken back first.
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
  return r;
end $$;

-- ---------- disputes ----------

create or replace function public.dispute_document(p_id uuid, p_note text, p_open boolean default true) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare d public.documents;
begin
  perform private.require(private.sees_money(), 'not_allowed');
  perform private.require(coalesce(p_note, '') <> '', 'reason_required');
  update public.documents set disputed = p_open, dispute_note = p_note where id = p_id returning * into d;
  perform private.require(found, 'not_found');
  perform private.log(case when p_open then 'dispute' else 'resolve_dispute' end, 'documents', p_id::text, p_note);
  return d;
end $$;

-- ---------- prices: proposed by anyone, approved by the owner; old prices are never edited ----------

create or replace function public.propose_price(p_item uuid, p_channel text, p_price numeric, p_from date, p_source text default null) returns public.prices
language plpgsql security definer set search_path = '' as $$
declare r public.prices;
begin
  perform private.require(private.sees_money(), 'not_allowed');
  perform private.require(private.item_kind(p_item) = 'product', 'sale_needs_product');
  perform private.require(p_price >= 0, 'price_required');
  insert into public.prices (item_id, channel_code, price, valid_from, source, proposed_by)
  values (p_item, p_channel, p_price, p_from, p_source, private.member_id()) returning * into r;
  if private.is_owner() then r := public.decide_price(r.id, true); end if;
  return r;
end $$;

create or replace function public.decide_price(p_id uuid, p_approve boolean) returns public.prices
language plpgsql security definer set search_path = '' as $$
declare r public.prices;
begin
  perform private.require(private.is_owner(), 'owner_only');
  select * into r from public.prices where id = p_id and status = 'pending' for update;
  perform private.require(found, 'not_pending');
  if p_approve then
    update public.prices set valid_to = r.valid_from - 1
      where item_id = r.item_id and channel_code = r.channel_code and status = 'approved'
        and valid_from < r.valid_from and (valid_to is null or valid_to >= r.valid_from);
    update public.prices set status = 'approved', approved_by = private.member_id(), approved_at = now() where id = p_id returning * into r;
  else
    update public.prices set status = 'rejected', approved_by = private.member_id(), approved_at = now() where id = p_id returning * into r;
  end if;
  return r;
end $$;

-- ---------- close a month ----------

create or replace function public.close_month(p_month date, p_close boolean default true) returns public.periods
language plpgsql security definer set search_path = '' as $$
declare r public.periods;
begin
  perform private.require(private.is_owner(), 'owner_only');
  insert into public.periods (month) values (date_trunc('month', p_month)::date) on conflict do nothing;
  update public.periods set closed_at = case when p_close then now() end, closed_by = private.member_id()
    where month = date_trunc('month', p_month)::date returning * into r;
  return r;
end $$;
