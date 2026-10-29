-- ICONSIAM checks: sales layer (snapshots, finals, revisions, partial coverage, counts),
-- delivery workflow (plan, dispatch, partial receipt), mapping review, idempotency.
-- Fictional products and quantities only (this repo is public). Runs as one DO block and
-- always rolls back by raising its report.
do $test$
declare
  u_o uuid := gen_random_uuid();
  a public.stock_items; b public.stock_items; c public.stock_items;
  s public.consignment_shipments;
  r jsonb; r2 jsonb;
  n numeric; n2 numeric; k integer;
  out text := '';
  m0 date := date '2026-06-01';
  rep jsonb;
  line_a uuid; line_b uuid;
begin
  insert into auth.users (id, email, aud, role, instance_id, email_confirmed_at) values
    (u_o, 'test-ics@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', now());
  insert into public.members (email, display_name, role) values ('test-ics@example.test', 'Test ICS', 'owner');
  insert into private.owner_accounts (user_id) values (u_o);
  perform set_config('request.jwt.claims', json_build_object('sub', u_o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  a := public.save_item('{"code":"T-ICS-A","name_th":"ทดสอบ A","name_en":"Test A","category_code":"FIN-BEANS","base_unit":"pc"}');
  b := public.save_item('{"code":"T-ICS-B","name_th":"ทดสอบ B","name_en":"Test B","category_code":"FIN-BEANS","base_unit":"pc"}');
  c := public.save_item('{"code":"T-ICS-C","name_th":"ทดสอบ C","name_en":"Test C","category_code":"FIN-BEANS","base_unit":"pc"}');

  -- ===== untracked: sales before any stock record at ICONSIAM don't touch stock =====
  r := public.commit_sales_update(jsonb_build_object('kind', 'snapshot', 'source_ref', 'T|snap|apr-10', 'coverage_start', '2026-04-01',
    'coverage_end', '2026-04-10', 'as_of', '2026-04-10', 'lines', jsonb_build_array(jsonb_build_object('item_id', c.id, 'qty', 4, 'net', 1600))));
  out := out || format('untracked: bucket=%s on_hand=%s; ', r -> 'stock' -> 0 ->> 'bucket', public.on_hand(c.id, 'ICS'));

  -- ===== opening at ICONSIAM (May 31): 30 A, 10 B =====
  perform public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'opening', 'doc_date', '2026-05-31',
    'lines', jsonb_build_array(
      jsonb_build_object('kind', 'stock', 'item_id', a.id, 'qty', 30, 'location', 'ICS'),
      jsonb_build_object('kind', 'stock', 'item_id', b.id, 'qty', 10, 'location', 'ICS'))));

  -- ===== cumulative snapshots: 10 then 16 means 16 =====
  r := public.commit_sales_update(jsonb_build_object('kind', 'snapshot', 'source_ref', 'T|snap|06-05', 'coverage_start', '2026-06-01',
    'coverage_end', '2026-06-05', 'as_of', '2026-06-05', 'lines', jsonb_build_array(jsonb_build_object('item_id', a.id, 'qty', 10, 'net', 4000))));
  r := public.commit_sales_update(jsonb_build_object('kind', 'snapshot', 'source_ref', 'T|snap|06-12', 'coverage_start', '2026-06-01',
    'coverage_end', '2026-06-12', 'as_of', '2026-06-12', 'lines', jsonb_build_array(jsonb_build_object('item_id', a.id, 'qty', 16, 'net', 6400))));
  execute 'reset role';
  select final_qty + prov_qty into n from private.effective_sales('ICONSIAM', 'ICS', m0) where item_id = a.id;
  execute 'set local role authenticated';
  out := out || format('snapshots 10→16: effective=%s second_deduction=%s on_hand=%s; ', n, r -> 'stock' -> 0 ->> 'diff', public.on_hand(a.id, 'ICS'));

  -- ===== reimport: nothing changes =====
  select count(*) into k from public.stock_moves where item_id = a.id;
  r2 := public.commit_sales_update(jsonb_build_object('kind', 'snapshot', 'source_ref', 'T|snap|06-12', 'coverage_start', '2026-06-01',
    'coverage_end', '2026-06-12', 'as_of', '2026-06-12', 'lines', jsonb_build_array(jsonb_build_object('item_id', a.id, 'qty', 16, 'net', 6400))));
  out := out || format('reimport: unchanged=%s moves_added=%s; ', r2 ->> 'unchanged',
    (select count(*) from public.stock_moves where item_id = a.id) - k);
  begin
    perform public.commit_sales_update(jsonb_build_object('kind', 'snapshot', 'source_ref', 'T|snap|06-12', 'coverage_start', '2026-06-01',
      'coverage_end', '2026-06-12', 'as_of', '2026-06-12', 'lines', jsonb_build_array(jsonb_build_object('item_id', a.id, 'qty', 17, 'net', 6800))));
    out := out || 'changed source ACCEPTED (bad); ';
  exception when others then out := out || format('same ref, other figures refused (%s); ', sqlerrm); end;

  -- ===== intervals after the snapshot are added; an overlapping interval is refused =====
  perform public.commit_sales_update(jsonb_build_object('kind', 'interval', 'source_ref', 'T|int|06-13-14', 'coverage_start', '2026-06-13',
    'coverage_end', '2026-06-14', 'lines', jsonb_build_array(jsonb_build_object('item_id', a.id, 'qty', 2, 'net', 800))));
  begin
    perform public.commit_sales_update(jsonb_build_object('kind', 'interval', 'source_ref', 'T|int|06-14', 'coverage_start', '2026-06-14',
      'coverage_end', '2026-06-14', 'lines', jsonb_build_array(jsonb_build_object('item_id', a.id, 'qty', 1, 'net', 400))));
    out := out || 'overlapping interval ACCEPTED (bad); ';
  exception when others then out := out || format('overlapping interval refused (%s); ', sqlerrm); end;
  execute 'reset role';
  select final_qty + prov_qty into n from private.effective_sales('ICONSIAM', 'ICS', m0) where item_id = a.id;
  execute 'set local role authenticated';
  out := out || format('snapshot 16 + interval 2 = %s, on_hand=%s; ', n, public.on_hand(a.id, 'ICS'));

  -- ===== official final 20 / 8,000 replaces provisional 18: only 2 more leave stock =====
  rep := jsonb_build_object('report', jsonb_build_object('report_no', 'TEST-0601', 'branch_code', '9999', 'branch_name', 'Test branch',
    'period_start', '2026-06-01', 'period_end', '2026-06-30', 'generated_at', '2026-07-03', 'gp_percent', 25,
    'lines', jsonb_build_array(jsonb_build_object('item_code', 'T-ICS-A-CODE', 'description', 'Test A', 'qty', 20, 'unit_price', 400,
      'sales_amount', 8000, 'discount', 0, 'net_sales', 8000, 'supplier_amount', 6000)),
    'totals', jsonb_build_object('units', 20, 'net_sales', 8000, 'gp_amount', 2000, 'supplier_amount', 6000, 'vat_amount', 0)));
  -- The report's item code must point to the product (store code), never a guess.
  execute 'reset role';
  update public.stock_items set iconsiam_code = 'T-ICS-A-CODE' where id = a.id;
  execute 'set local role authenticated';
  r := public.preview_sales_update(rep || '{"kind":"final"}'::jsonb);
  out := out || format('preview final: ready=%s diff=%s (nothing saved: %s); ', r ->> 'ready', r -> 'stock' -> 0 ->> 'diff',
    (select count(*) from public.sales_updates where kind = 'final' and source_ref like 'ICONSIAM|TEST-0601%'));
  r := public.commit_sales_update(rep || '{"kind":"final"}'::jsonb);
  execute 'reset role';
  select final_qty, prov_qty, final_net into n, n2, k from private.effective_sales('ICONSIAM', 'ICS', m0) where item_id = a.id;
  execute 'set local role authenticated';
  out := out || format('final: authoritative=%s provisional_left=%s value=%s deducted_now=%s on_hand=%s; ', n, n2, k,
    r -> 'stock' -> 0 ->> 'diff', public.on_hand(a.id, 'ICS'));
  r2 := public.commit_sales_update(rep || '{"kind":"final"}'::jsonb);
  out := out || format('final reimport unchanged=%s; ', r2 ->> 'unchanged');

  -- ===== a second official report needs to be a confirmed revision; then only the difference =====
  begin
    perform public.commit_sales_update(jsonb_set(rep, '{report,generated_at}', '"2026-07-09"') || '{"kind":"final"}'::jsonb
      || jsonb_build_object('report', (rep -> 'report') || jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('item_code', 'T-ICS-A-CODE',
        'description', 'Test A', 'qty', 21, 'unit_price', 400, 'sales_amount', 8400, 'discount', 0, 'net_sales', 8400, 'supplier_amount', 6300)),
        'totals', jsonb_build_object('units', 21, 'net_sales', 8400, 'gp_amount', 2100, 'supplier_amount', 6300, 'vat_amount', 0))));
    out := out || 'unconfirmed revision ACCEPTED (bad); ';
  exception when others then out := out || format('unconfirmed second report refused (%s); ', sqlerrm); end;
  r := public.commit_sales_update(jsonb_build_object('kind', 'final', 'revision_of', r -> 'update' ->> 'id',
    'report', (rep -> 'report') || jsonb_build_object('generated_at', '2026-07-09',
      'lines', jsonb_build_array(jsonb_build_object('item_code', 'T-ICS-A-CODE', 'description', 'Test A', 'qty', 21, 'unit_price', 400,
        'sales_amount', 8400, 'discount', 0, 'net_sales', 8400, 'supplier_amount', 6300)),
      'totals', jsonb_build_object('units', 21, 'net_sales', 8400, 'gp_amount', 2100, 'supplier_amount', 6300, 'vat_amount', 0))));
  execute 'reset role';
  select final_qty into n from private.effective_sales('ICONSIAM', 'ICS', m0) where item_id = a.id;
  execute 'set local role authenticated';
  out := out || format('revision v%s: authoritative=%s deducted_now=%s on_hand=%s posted_reports_for_month=%s superseded=%s; ',
    r -> 'update' ->> 'version', n, r -> 'stock' -> 0 ->> 'diff', public.on_hand(a.id, 'ICS'),
    (select count(*) from public.documents where doc_type = 'consignment' and status = 'posted' and data ->> 'report_no' = 'TEST-0601'),
    (select count(*) from public.documents where doc_type = 'consignment' and status = 'superseded' and data ->> 'report_no' = 'TEST-0601'));

  -- ===== count after the provisional point absorbs the final's difference (B) =====
  perform public.commit_sales_update(jsonb_build_object('kind', 'snapshot', 'source_ref', 'T|snap|07-20', 'coverage_start', '2026-07-01',
    'coverage_end', '2026-07-20', 'as_of', '2026-07-20', 'lines', jsonb_build_array(jsonb_build_object('item_id', b.id, 'qty', 3, 'net', 1200))));
  -- Physical count on Aug 2: 5 on the shelf (the extra 2 sold after the 20th are already gone).
  perform public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'count', 'doc_date', '2026-08-02',
    'location_code', 'ICS', 'lines', jsonb_build_array(jsonb_build_object('item_id', b.id, 'qty', 5))));
  execute 'reset role';
  update public.stock_items set iconsiam_code = 'T-ICS-B-CODE' where id = b.id;
  execute 'set local role authenticated';
  r := public.commit_sales_update(jsonb_build_object('kind', 'final', 'report', jsonb_build_object('report_no', 'TEST-0701', 'branch_code', '9999',
    'period_start', '2026-07-01', 'period_end', '2026-07-31', 'generated_at', '2026-08-04', 'gp_percent', 25,
    'lines', jsonb_build_array(jsonb_build_object('item_code', 'T-ICS-B-CODE', 'description', 'Test B', 'qty', 5, 'unit_price', 400,
      'sales_amount', 2000, 'discount', 0, 'net_sales', 2000, 'supplier_amount', 1500)),
    'totals', jsonb_build_object('units', 5, 'net_sales', 2000, 'gp_amount', 500, 'supplier_amount', 1500, 'vat_amount', 0))));
  out := out || format('count then final: diff=%s bucket=%s on_hand=%s (count said 5); ', r -> 'stock' -> 0 ->> 'diff',
    r -> 'stock' -> 0 ->> 'bucket', public.on_hand(b.id, 'ICS'));

  -- ===== partial final (Sep 1–15) keeps the interval after it (Sep 16–18) =====
  perform public.commit_sales_update(jsonb_build_object('kind', 'interval', 'source_ref', 'T|int|09-03', 'coverage_start', '2026-09-03',
    'coverage_end', '2026-09-03', 'lines', jsonb_build_array(jsonb_build_object('item_id', a.id, 'qty', 1, 'net', 400))));
  perform public.commit_sales_update(jsonb_build_object('kind', 'interval', 'source_ref', 'T|int|09-16-18', 'coverage_start', '2026-09-16',
    'coverage_end', '2026-09-18', 'lines', jsonb_build_array(jsonb_build_object('item_id', a.id, 'qty', 2, 'net', 800))));
  perform public.commit_sales_update(jsonb_build_object('kind', 'final', 'report', jsonb_build_object('report_no', 'TEST-0901H', 'branch_code', '9999',
    'period_start', '2026-09-01', 'period_end', '2026-09-15', 'generated_at', '2026-09-16', 'gp_percent', 25,
    'lines', jsonb_build_array(jsonb_build_object('item_code', 'T-ICS-A-CODE', 'description', 'Test A', 'qty', 3, 'unit_price', 400,
      'sales_amount', 1200, 'discount', 0, 'net_sales', 1200, 'supplier_amount', 900)),
    'totals', jsonb_build_object('units', 3, 'net_sales', 1200, 'gp_amount', 300, 'supplier_amount', 900, 'vat_amount', 0))));
  execute 'reset role';
  select final_qty, prov_qty into n, n2 from private.effective_sales('ICONSIAM', 'ICS', date '2026-09-01') where item_id = a.id;
  execute 'set local role authenticated';
  out := out || format('partial final: final=%s kept_provisional=%s (Sep 3 interval superseded, Sep 16–18 kept); ', n, n2);

  -- ===== delivery: planning moves nothing; dispatch → transit; partial receipt =====
  execute 'reset role';
  insert into public.stock_moves (move_date, item_id, location_code, qty, kind, doc_type, doc_id)
  values ('2026-10-01', a.id, 'BY', 50, 'opening', 'opening', gen_random_uuid());
  execute 'set local role authenticated';
  n := public.on_hand(a.id, 'BY');
  s := public.save_shipment(jsonb_build_object('client_key', gen_random_uuid(), 'doc_date', '2026-10-05', 'planned_dispatch', '2026-10-06',
    'lines', jsonb_build_array(jsonb_build_object('item_id', a.id, 'qty', 10, 'unit_price', 400))));
  out := out || format('planned %s: branch %s→%s ICS_transit=%s; ', s.ship_no, n, public.on_hand(a.id, 'BY'), public.on_hand(a.id, 'TRANSIT'));
  s := public.dispatch_shipment(s.id, '2026-10-06', '2026-10-08');
  out := out || format('dispatched: branch=%s transit=%s; ', public.on_hand(a.id, 'BY'), public.on_hand(a.id, 'TRANSIT'));
  n := public.on_hand(a.id, 'ICS');
  select id into line_a from public.consignment_shipment_lines where shipment_id = s.id;
  begin
    perform public.receive_shipment(jsonb_build_object('id', s.id, 'date', '2026-10-08',
      'lines', jsonb_build_object(line_a::text, jsonb_build_object('accepted', 7, 'rejected', 2, 'missing', 1))));
    out := out || 'short receipt without reason ACCEPTED (bad); ';
  exception when others then out := out || format('short receipt needs a reason (%s); ', sqlerrm); end;
  s := public.receive_shipment(jsonb_build_object('id', s.id, 'date', '2026-10-08', 'note', 'Two dented bags returned, one missing',
    'lines', jsonb_build_object(line_a::text, jsonb_build_object('accepted', 7, 'rejected', 2, 'missing', 1))));
  out := out || format('received %s/%s: ICS +%s branch=%s (2 back) transit=%s; ', s.status, s.receipt_status,
    public.on_hand(a.id, 'ICS') - n, public.on_hand(a.id, 'BY'), public.on_hand(a.id, 'TRANSIT'));
  s := public.receive_shipment(jsonb_build_object('id', s.id, 'date', '2026-10-08'));
  out := out || format('receipt retried: ICS unchanged=%s; ', public.on_hand(a.id, 'ICS') - n = 7);

  -- ===== a form with one barcode on two codes: review before dispatch =====
  s := public.save_shipment(jsonb_build_object('client_key', gen_random_uuid(), 'doc_date', '2026-10-10', 'source_ref', 'T|form|1',
    'lines', jsonb_build_array(
      jsonb_build_object('source_code', 'T-BA-1', 'barcode', '0000000000001', 'description', 'Test A 200 g', 'package_size', '200 g', 'qty', 3, 'unit_price', 400),
      jsonb_build_object('source_code', 'T-BA-2', 'barcode', '0000000000001', 'description', 'Test B 200 g', 'package_size', '200 g', 'qty', 3, 'unit_price', 400))));
  out := out || format('shared barcode → maps %s; ', (select string_agg(status || ':' || issues::text, ', ' order by source_code)
    from public.channel_item_maps where source_code in ('T-BA-1', 'T-BA-2')));
  begin
    perform public.dispatch_shipment(s.id, '2026-10-11');
    out := out || 'dispatch before review ACCEPTED (bad); ';
  exception when others then out := out || format('dispatch before review refused (%s); ', sqlerrm); end;
  perform public.review_item_map(jsonb_build_object('id', (select id from public.channel_item_maps where source_code = 'T-BA-1'), 'item_id', a.id, 'status', 'reviewed'));
  perform public.review_item_map(jsonb_build_object('id', (select id from public.channel_item_maps where source_code = 'T-BA-2'), 'item_id', b.id, 'status', 'reviewed'));
  s := public.dispatch_shipment(s.id, '2026-10-11');
  out := out || format('after review: %s; ', s.status);
  out := out || format('same form again returns %s; ', (public.save_shipment(jsonb_build_object('client_key', gen_random_uuid(), 'source_ref', 'T|form|1',
    'lines', jsonb_build_array(jsonb_build_object('item_id', a.id, 'qty', 1))))).ship_no = s.ship_no);

  raise exception 'TEST REPORT (rolled back): %', out;
end $test$;
