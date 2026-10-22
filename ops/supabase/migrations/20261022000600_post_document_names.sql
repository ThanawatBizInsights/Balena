-- post_document has a variable called "data", the same as the documents column. The duplicate
-- report and duplicate order checks compare the two, so name lookups inside the function prefer
-- the variable (table columns there are always written with their alias, e.g. x.data).
-- Same function as in 20261022000300_documents.sql plus the #variable_conflict line.

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
