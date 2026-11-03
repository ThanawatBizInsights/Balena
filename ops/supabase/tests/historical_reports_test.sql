-- Historical official reports (sales only) and stock baselines. Fictional items, November 2025;
-- everything is rolled back at the end (the final RAISE carries the results).
do $$
declare
  owner_user uuid := (select user_id from private.owner_accounts limit 1);
  a uuid; b uuid;
  moves_before bigint; hash_before text;
  r jsonb; u1 uuid; u2 uuid; doc1 uuid;
  res jsonb := '{}'::jsonb;
  bl public.stock_baselines;
  rep jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', owner_user, 'role', 'authenticated')::text, true);
  insert into public.stock_items (code, name_en, name_th, kind, base_unit, category, category_code, active)
  values ('T-HIST-A', 'Test A', 'ทดสอบ A', 'product', 'pc', 'beans', 'FIN-BEANS', true) returning id into a;
  insert into public.stock_items (code, name_en, name_th, kind, base_unit, category, category_code, active)
  values ('T-HIST-B', 'Test B', 'ทดสอบ B', 'product', 'pc', 'beans', 'FIN-BEANS', true) returning id into b;
  -- Some stock at the store, and an interim update for the month (ledger), before the official report.
  perform private.move('2025-10-31', a, 'ICS', 10, 'opening', 'opening', gen_random_uuid());
  r := public.commit_sales_update(jsonb_build_object('kind', 'interval', 'coverage_start', '2025-11-01', 'coverage_end', '2025-11-10',
    'source_ref', 'TEST-HIST-INT', 'lines', jsonb_build_array(jsonb_build_object('item_id', a, 'qty', 3, 'net', 300))));
  res := res || jsonb_build_object('interim_stock', r -> 'stock');

  select count(*), md5(string_agg(id::text || qty::text, ',' order by id)) into moves_before, hash_before from public.stock_moves;
  rep := jsonb_build_object('report_no', 'TEST-HIST-1', 'branch_code', '9999', 'branch_name', 'TEST', 'period_code', 'P25111',
    'period_start', '2025-11-01', 'period_end', '2025-11-30', 'generated_at', '2025-12-03', 'gp_percent', 25, 'row_identity', true,
    'source', jsonb_build_object('file', 'test.pdf'),
    'totals', jsonb_build_object('units', 7, 'net_sales', 2200, 'gp_amount', 550, 'supplier_amount', 1650, 'vat_amount', 0,
      'sales_before_returns', 2300, 'returns', -100),
    'lines', jsonb_build_array(
      jsonb_build_object('row', 1, 'type', 'S', 'item_code', '000123', 'barcode', '0090000000017', 'description', 'Test A', 'qty', 2, 'unit_price', 100, 'sales_amount', 200, 'net_sales', 200, 'supplier_amount', 150, 'item_id', a),
      jsonb_build_object('row', 2, 'type', 'S', 'item_code', '000123', 'barcode', '000123', 'description', 'Test A', 'qty', 3, 'unit_price', 100, 'sales_amount', 300, 'net_sales', 300, 'supplier_amount', 225, 'item_id', a),
      jsonb_build_object('row', 3, 'type', 'S', 'item_code', '999', 'barcode', '999', 'description', 'Event', 'qty', 1, 'unit_price', 1500, 'sales_amount', 1500, 'net_sales', 1500, 'supplier_amount', 1125, 'allocation', 'pending'),
      jsonb_build_object('row', 4, 'type', 'S', 'item_code', '999', 'barcode', '999', 'description', 'Event', 'qty', 2, 'unit_price', 150, 'sales_amount', 300, 'net_sales', 300, 'supplier_amount', 225, 'allocation', 'pending'),
      jsonb_build_object('row', 5, 'type', 'R', 'item_code', '000123', 'barcode', '000123', 'description', 'Test A', 'qty', -1, 'unit_price', -100, 'sales_amount', -100, 'net_sales', -100, 'supplier_amount', -75, 'item_id', a)));
  r := public.commit_sales_update(jsonb_build_object('kind', 'final', 'inventory_effect', 'none', 'report', rep));
  u1 := (r -> 'update' ->> 'id')::uuid;
  doc1 := (r -> 'update' ->> 'doc_id')::uuid;
  res := res || jsonb_build_object(
    'final_stock', r -> 'stock', 'replaced_interim', r -> 'replaced_interim',
    'moves_unchanged', (select count(*) from public.stock_moves) = moves_before
      and (select md5(string_agg(id::text || qty::text, ',' order by id)) from public.stock_moves) = hash_before,
    'doc_rows', (select count(*) from public.doc_lines where doc_id = doc1),
    'doc_stock_flag', (select data ->> 'stock' from public.documents where id = doc1),
    'layer_lines', (select jsonb_agg(jsonb_build_object('item', coalesce((select code from public.stock_items where id = l.item_id), 'UNALLOCATED'),
        'qty', l.qty, 'net', l.net, 'returns_qty', l.returns_qty, 'returns_net', l.returns_net, 'rows', l.source_rows) order by l.line_no)
      from public.sales_update_lines l where l.update_id = u1),
    'effective', (select jsonb_agg(jsonb_build_object('item', e.item_id is null, 'final', e.final_qty, 'prov', e.prov_qty, 'net', e.final_net))
      from private.effective_sales('ICONSIAM', 'ICS', '2025-11-01') e),
    'interim_status', (select status from public.sales_updates where source_ref = 'TEST-HIST-INT'));

  -- Re-import: nothing new.
  r := public.commit_sales_update(jsonb_build_object('kind', 'final', 'inventory_effect', 'none', 'report', rep));
  res := res || jsonb_build_object('reimport_unchanged', r -> 'unchanged',
    'reports_for_number', (select count(*) from public.documents where data ->> 'report_no' = 'TEST-HIST-1'));

  -- Interim updates later in the month never touch stock while the month is sales-only.
  r := public.commit_sales_update(jsonb_build_object('kind', 'interval', 'coverage_start', '2025-11-20', 'coverage_end', '2025-11-20',
    'source_ref', 'TEST-HIST-INT2', 'lines', jsonb_build_array(jsonb_build_object('item_id', b, 'qty', 1, 'net', 100))));
  res := res || jsonb_build_object('later_interim_stock', r -> 'stock');

  -- Allocate event row 3 to Test B: a revision with identical totals, still sales-only.
  r := public.allocate_report_rows(jsonb_build_object('update_id', u1, 'note', 'test allocation',
    'allocations', jsonb_build_array(jsonb_build_object('row', 3, 'item_id', b))));
  u2 := (r -> 'update' ->> 'id')::uuid;
  res := res || jsonb_build_object(
    'revision_version', r -> 'update' -> 'version', 'revision_effect', r -> 'inventory_effect',
    'revision_totals_equal', (select (x.totals ->> 'net') = (y.totals ->> 'net') and (x.totals ->> 'payable') = (y.totals ->> 'payable')
      from public.sales_updates x, public.sales_updates y where x.id = u1 and y.id = u2),
    'v1_status', (select status from public.sales_updates where id = u1),
    'v2_lines', (select jsonb_agg(jsonb_build_object('item', coalesce((select code from public.stock_items where id = l.item_id), 'UNALLOCATED'), 'qty', l.qty, 'net', l.net) order by l.line_no)
      from public.sales_update_lines l where l.update_id = u2),
    'moves_still_unchanged', (select count(*) from public.stock_moves) = moves_before);

  -- Signed arithmetic is checked: a return printed as a positive amount is refused.
  begin
    perform public.import_sales_report(jsonb_build_object('channel', 'ICONSIAM', 'location_code', 'ICS', 'report_no', 'TEST-BAD', 'branch_code', '9999',
      'period_start', '2025-11-01', 'period_end', '2025-11-30', 'gp_percent', 25, 'row_identity', true, 'inventory_effect', 'none',
      'totals', jsonb_build_object('units', -1, 'net_sales', 100, 'gp_amount', 25, 'supplier_amount', 75, 'vat_amount', 0),
      'lines', jsonb_build_array(jsonb_build_object('row', 1, 'type', 'R', 'item_code', '1', 'qty', -1, 'unit_price', -100, 'sales_amount', 100, 'net_sales', 100, 'supplier_amount', 75, 'item_id', a))));
    res := res || jsonb_build_object('bad_return', 'accepted');
  exception when others then res := res || jsonb_build_object('bad_return', sqlerrm);
  end;

  -- Baseline: draft, then confirmed on 15 Dec 2025: Test A counted 4 against a system balance of 10 − 3 = 7.
  bl := public.save_stock_baseline(jsonb_build_object('client_key', gen_random_uuid(), 'location_code', 'ICS', 'effective_at', '2025-12-15T10:30:00+07:00',
    'counted_by', 'Test counter', 'lines', jsonb_build_array(jsonb_build_object('item_id', a, 'qty', 4))));
  res := res || jsonb_build_object('baseline_draft_status', bl.status,
    'stock_before_confirm', (select sum(qty) from public.stock_moves where item_id = a and location_code = 'ICS'));
  bl := public.confirm_stock_baseline(bl.id);
  res := res || jsonb_build_object('baseline_status', bl.status,
    'stock_after_confirm', (select sum(qty) from public.stock_moves where item_id = a and location_code = 'ICS'));
  -- A monthly official report for December (ledger) spans the count with nothing recorded up to it: flagged, not deducted.
  rep := jsonb_build_object('report_no', 'TEST-HIST-2', 'branch_code', '9999', 'period_start', '2025-12-01', 'period_end', '2025-12-31',
    'generated_at', '2026-01-03', 'gp_percent', 25, 'row_identity', true,
    'totals', jsonb_build_object('units', 5, 'net_sales', 500, 'gp_amount', 125, 'supplier_amount', 375, 'vat_amount', 0),
    'lines', jsonb_build_array(jsonb_build_object('row', 1, 'type', 'S', 'item_code', '000123', 'qty', 5, 'unit_price', 100, 'sales_amount', 500, 'net_sales', 500, 'supplier_amount', 375, 'item_id', a)));
  r := public.commit_sales_update(jsonb_build_object('kind', 'final', 'report', rep));
  res := res || jsonb_build_object('spanning_final_stock', r -> 'stock',
    'stock_after_spanning_final', (select sum(qty) from public.stock_moves where item_id = a and location_code = 'ICS'));

  raise exception 'TEST RESULTS %', res;
end $$;
