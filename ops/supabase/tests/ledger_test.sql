-- End-to-end check of posting, approvals, costs, reversals and access rules.
-- Runs as one DO block and always rolls back (it ends by raising its own report), so it leaves
-- no rows behind. Run with the Supabase SQL editor or execute_sql against a project.
do $test$
declare
  u_owner uuid := gen_random_uuid();
  u_partner uuid := gen_random_uuid();
  u_staff uuid := gen_random_uuid();
  m_partner uuid;
  gb uuid; rb uuid; pr uuid;
  d public.documents;
  d2 public.documents;
  roast_id uuid; trf_id uuid; sale_id uuid; con_id uuid;
  n numeric; c numeric; k uuid := gen_random_uuid();
  out text := '';
  ok boolean;
  s jsonb;

begin
  -- test logins and members
  insert into auth.users (id, email, aud, role, instance_id) values
    (u_owner, 'test-owner@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (u_partner, 'test-partner@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (u_staff, 'test-staff@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into public.members (email, display_name, role, user_id) values
    ('test-owner@example.test', 'Test owner', 'owner', u_owner),
    ('test-partner@example.test', 'Test partner', 'partner', u_partner),
    ('test-staff@example.test', 'Test staff', 'staff', u_staff);
  select id into m_partner from public.members where user_id = u_partner;

  -- ===== as owner =====
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.stock_items (code, name_en, name_th, kind, base_unit) values ('T-GREEN', 'Test green', 'ทดสอบ', 'green_bean', 'g') returning id into gb;
  insert into public.stock_items (code, name_en, name_th, kind, base_unit) values ('T-ROAST', 'Test roasted', 'ทดสอบ', 'roasted_bean', 'g') returning id into rb;
  insert into public.stock_items (code, name_en, name_th, kind, base_unit, category, size_value, size_unit, pack)
    values ('T-BAG', 'Test bag', 'ทดสอบ', 'product', 'pc', 'beans', 200, 'g', 'bag') returning id into pr;

  -- purchase 10 kg green for 3,000 + 100 shipping
  d := public.post_document(jsonb_build_object('client_key', k, 'doc_type', 'purchase', 'doc_date', current_date, 'location_code', 'CK',
    'data', jsonb_build_object('supplier', 'Test supplier', 'paid', 'BANK-THANAWAT', 'shipping', 100),
    'attachments', jsonb_build_array('receipts/test.jpg'),
    'lines', jsonb_build_array(jsonb_build_object('item_id', gb, 'qty', 10000, 'amount', 3000))));
  out := out || format('purchase %s status=%s total=%s; ', d.doc_no, d.status, d.total);
  select avg_cost into c from public.item_costs where item_id = gb;
  out := out || format('green avg=%s (expect 0.31); ', round(c, 4));
  -- retry with the same key returns the same record
  d2 := public.post_document(jsonb_build_object('client_key', k, 'doc_type', 'purchase', 'doc_date', current_date));
  out := out || format('idempotent=%s; ', d2.id = d.id);
  select balance into n from public.account_balances where code = 'BANK-THANAWAT';
  out := out || format('bank=%s (expect -3100); ', n);

  -- ===== as staff: roast (needs approval: limits not agreed) =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  d := public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'production', 'doc_date', current_date, 'location_code', 'CK',
    'data', jsonb_build_object('kind', 'roast'),
    'lines', jsonb_build_array(jsonb_build_object('item_id', gb, 'qty', 5000, 'dir', 'in'), jsonb_build_object('item_id', rb, 'qty', 4200, 'dir', 'out'))));
  roast_id := d.id;
  out := out || format('roast status=%s loss=%s; ', d.status, d.data ->> 'roast_loss_pct');
  -- roast without weights fails
  begin
    perform public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'production', 'doc_date', current_date, 'location_code', 'CK',
      'data', jsonb_build_object('kind', 'roast'), 'lines', jsonb_build_array(jsonb_build_object('item_id', rb, 'qty', 4200, 'dir', 'out'))));
    out := out || 'roast-no-input ACCEPTED (bad); ';
  exception when others then out := out || format('roast-no-input refused (%s); ', sqlerrm); end;
  -- staff may not record expenses
  begin
    perform public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'expense', 'doc_date', current_date,
      'total', 50, 'data', jsonb_build_object('category', 'supplies', 'paid', 'CASH-CK', 'no_receipt_reason', 'lost')));
    out := out || 'staff-expense ACCEPTED (bad); ';
  exception when others then out := out || format('staff-expense refused (%s); ', sqlerrm); end;
  -- staff can't approve
  begin
    perform public.decide_document(roast_id, true, null);
    out := out || 'staff-approve ACCEPTED (bad); ';
  exception when others then out := out || format('staff-approve refused (%s); ', sqlerrm); end;
  -- staff sees no money or costs
  select count(*) into n from public.money_moves;
  out := out || format('staff money rows=%s; ', n);
  select count(*) into n from public.item_costs;
  out := out || format('staff cost rows=%s; ', n);
  select count(*) into n from public.documents where doc_type = 'purchase';
  out := out || format('staff purchase docs=%s; ', n);

  -- ===== owner approves the roast =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  d := public.decide_document(roast_id, true, 'ok');
  out := out || format('roast approved=%s green on hand=%s roasted=%s; ', d.status, public.on_hand(gb, 'CK'), public.on_hand(rb, 'CK'));
  select avg_cost into c from public.item_costs where item_id = rb;
  out := out || format('roasted avg=%s (expect %s); ', round(c, 6), round(5000 * 0.31 / 4200, 6));

  -- pack 2,000 g roasted into 10 bags (owner posts directly)
  d := public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'production', 'doc_date', current_date, 'location_code', 'CK',
    'data', jsonb_build_object('kind', 'pack'),
    'lines', jsonb_build_array(jsonb_build_object('item_id', rb, 'qty', 2000, 'dir', 'in'), jsonb_build_object('item_id', pr, 'qty', 10, 'dir', 'out'))));
  select avg_cost into c from public.item_costs where item_id = pr;
  out := out || format('pack %s bag cost=%s; ', d.status, round(c, 4));

  -- transfer 5 bags to ICONSIAM, 4 arrive
  d := public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'transfer', 'doc_date', current_date, 'location_code', 'CK',
    'data', jsonb_build_object('to', 'ICS'), 'lines', jsonb_build_array(jsonb_build_object('item_id', pr, 'qty', 5))));
  trf_id := d.id;
  out := out || format('transfer CK=%s transit=%s; ', public.on_hand(pr, 'CK'), public.on_hand(pr, 'TRANSIT'));
  begin
    perform public.receive_transfer(trf_id, current_date, jsonb_build_object((select id::text from public.doc_lines where doc_id = trf_id), 4), null);
    out := out || 'short-without-reason ACCEPTED (bad); ';
  exception when others then out := out || format('short-without-reason refused (%s); ', sqlerrm); end;
  perform public.receive_transfer(trf_id, current_date, jsonb_build_object((select id::text from public.doc_lines where doc_id = trf_id), 4), 'one bag damaged');
  out := out || format('received ICS=%s transit=%s; ', public.on_hand(pr, 'ICS'), public.on_hand(pr, 'TRANSIT'));

  -- ===== partner: ICONSIAM report (always needs approval) =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_partner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  d := public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'consignment', 'doc_date', current_date, 'location_code', 'ICS',
    'data', jsonb_build_object('channel', 'ICONSIAM', 'report_no', 'TEST-P1', 'gp_percent', 25, 'report_total', 1200),
    'lines', jsonb_build_array(jsonb_build_object('item_id', pr, 'qty', 3, 'unit_price', 400, 'amount', 1200))));
  con_id := d.id;
  out := out || format('consignment %s due=%s gp=%s date=%s; ', d.status, d.data ->> 'amount_due', d.data ->> 'gp_amount', d.data ->> 'due_date');
  begin
    perform public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'consignment', 'doc_date', current_date, 'location_code', 'ICS',
      'data', jsonb_build_object('channel', 'ICONSIAM', 'report_no', 'TEST-P1', 'gp_percent', 25),
      'lines', jsonb_build_array(jsonb_build_object('item_id', pr, 'qty', 1, 'amount', 400))));
    out := out || 'duplicate-report ACCEPTED (bad); ';
  exception when others then out := out || format('duplicate-report refused (%s); ', sqlerrm); end;
  perform public.dispute_document(roast_id, 'Check the roasted weight', true);
  select disputed into ok from public.documents where id = roast_id;
  out := out || format('dispute=%s; ', ok);

  -- ===== owner approves the report =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.decide_document(con_id, true, null);
  out := out || format('after report ICS=%s; ', public.on_hand(pr, 'ICS'));
  select open_amount into n from public.receivables where id = con_id;
  out := out || format('receivable=%s; ', n);

  -- ===== staff: shop sale, overselling refused, reverse own sale =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_staff, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  d := public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'sale', 'doc_date', current_date, 'location_code', 'CK',
    'data', jsonb_build_object('channel', 'SHOP-CK', 'paid', 'CASH-CK'),
    'lines', jsonb_build_array(jsonb_build_object('item_id', pr, 'qty', 2, 'unit_price', 400))));
  sale_id := d.id;
  out := out || format('sale %s total=%s CK=%s; ', d.status, d.total, public.on_hand(pr, 'CK'));
  begin
    perform public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'sale', 'doc_date', current_date, 'location_code', 'CK',
      'data', jsonb_build_object('channel', 'SHOP-CK', 'paid', 'CASH-CK'),
      'lines', jsonb_build_array(jsonb_build_object('item_id', pr, 'qty', 100, 'unit_price', 400))));
    -- Since 2026-10-24 stock may go below zero temporarily: the sale is saved and flagged provisional.
    out := out || format('oversell saved (negative stock allowed) CK=%s; ', public.on_hand(pr, 'CK'));
  exception when others then out := out || format('oversell refused (%s, unexpected); ', sqlerrm); end;
  begin
    update public.stock_moves set qty = 1;
    out := out || 'ledger-edit ran; ';
  exception when others then out := out || format('ledger-edit refused (%s); ', sqlerrm); end;
  begin
    update public.documents set total = 1 where id = sale_id;
    get diagnostics n = row_count;
    out := out || format('doc-edit rows=%s; ', n);
  exception when others then out := out || format('doc-edit refused (%s); ', sqlerrm); end;
  d := public.reverse_document(sale_id, current_date, 'wrong item');
  out := out || format('reversal %s total=%s CK=%s; ', d.doc_no, d.total, public.on_hand(pr, 'CK'));

  -- ===== owner: dashboard and cash =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  s := public.month_summary(current_date);
  out := out || format('summary sales=%s cogs=%s gp=%s fees=%s pending=%s recv=%s; ',
    s ->> 'net_sales', s ->> 'cogs', s ->> 'gross_profit', s ->> 'channel_fees', s ->> 'pending_approvals', s ->> 'open_receivables');
  select balance into n from public.account_balances where code = 'CASH-CK';
  out := out || format('shop cash=%s (expect 0 after reversal); ', n);
  select count(*) into n from public.audit_log where table_name = 'documents';
  out := out || format('audit doc rows=%s; ', n);

  -- ===== anonymous =====
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin
    select count(*) into n from public.documents;
    out := out || format('anon docs=%s (bad); ', n);
  exception when others then out := out || format('anon refused (%s); ', sqlerrm); end;
  begin
    perform public.post_document('{}'::jsonb);
    out := out || 'anon post ran (bad); ';
  exception when others then out := out || format('anon post refused (%s); ', sqlerrm); end;
  execute 'reset role';

  raise exception 'TEST REPORT (rolled back): %', out;
end
$test$;
