-- Inventory checks: categories and item permissions, units, temporary negative stock, output-first
-- batches, archiving, owner identity. Fictional items and quantities only (this repo is public).
-- Runs as one DO block and always rolls back by raising its report.
do $test$
declare
  u_o uuid := gen_random_uuid();   -- owner login (trusted table)
  u_m uuid := gen_random_uuid();   -- ordinary member
  u_fake uuid := gen_random_uuid(); -- member row saying "owner" but not in the trusted table
  g public.stock_items; ro public.stock_items; cb public.stock_items; lb public.stock_items; un public.stock_items;
  d public.documents; b public.documents; c1 public.documents; c2 public.documents;
  k uuid := gen_random_uuid();
  n numeric; out text := ''; ok boolean; s jsonb;
begin
  insert into auth.users (id, email, aud, role, instance_id, email_confirmed_at) values
    (u_o, 'test-o@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', now()),
    (u_m, 'test-m@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', now()),
    (u_fake, 'test-f@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', now());
  insert into public.members (email, display_name, role) values ('test-o@example.test', 'Test O', 'owner');
  insert into public.members (email, display_name) values ('test-m@example.test', 'Test M');
  insert into public.members (email, display_name, role) values ('test-f@example.test', 'Test F', 'owner');
  insert into private.owner_accounts (user_id) values (u_o);

  -- ===== member: add and edit items =====
  perform set_config('request.jwt.claims', json_build_object('sub', u_m, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  g := public.save_item('{"code":"T-GREEN","name_th":"ทดสอบดิบ","name_en":"Test green","category_code":"RAW-GREEN","base_unit":"g"}');
  ro := public.save_item('{"code":"T-ROAST","name_th":"ทดสอบคั่ว","name_en":"Test roasted","category_code":"ROAST","base_unit":"g"}');
  cb := public.save_item('{"code":"T-CB","name_th":"ทดสอบโคลด์บรูว์","name_en":"Test cold brew","category_code":"FIN-COLDBREW","base_unit":"g"}');
  lb := public.save_item('{"code":"T-LABEL","name_th":"ทดสอบฉลาก","name_en":"Test label","category_code":"PACK","base_unit":"pc","units":[{"unit":"pack","factor":100}]}');
  un := public.save_item('{"code":"T-UNUSED","name_th":"ไม่ใช้","name_en":"Unused","category_code":"CONS","base_unit":"pc"}');
  out := out || format('kinds=%s/%s/%s/%s product unit=%s; ', g.kind, ro.kind, cb.kind, lb.kind, cb.base_unit);
  g := public.save_item(jsonb_build_object('id', g.id, 'version', g.version, 'name_th', 'ทดสอบดิบ 2', 'name_en', 'Test green 2', 'min_level', 100));
  out := out || format('member rename=%s; ', g.name_en);
  begin perform public.save_item(jsonb_build_object('id', g.id, 'name_th', 'x', 'name_en', 'x', 'category_code', 'RAW'));
    out := out || 'member category move ACCEPTED (bad); ';
  exception when others then out := out || format('member category move refused (%s); ', sqlerrm); end;
  begin perform public.archive_item(g.id); out := out || 'member archive ACCEPTED (bad); ';
  exception when others then out := out || format('member archive refused (%s); ', sqlerrm); end;
  begin update public.stock_items set active = false where id = g.id; out := out || 'member direct update ran (bad); ';
  exception when others then out := out || format('member direct update refused (%s); ', sqlerrm); end;
  -- Removal is a row-level rule (owner only, unused items only); its condition is checked directly.
  out := out || format('member may remove unused=%s; ', private.is_owner() and not private.item_used(un.id));
  begin perform public.save_item(jsonb_build_object('code', 'T-BAD', 'name_th', 'x', 'name_en', 'x', 'category_code', 'PACK', 'base_unit', 'pc', 'units', '[{"unit":"kg","factor":5}]'::jsonb));
    out := out || 'built-in unit as pack ACCEPTED (bad); ';
  exception when others then out := out || format('built-in unit as pack refused (%s); ', sqlerrm); end;

  -- ===== owner: purchases in kg and packs =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  d := public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'purchase', 'doc_date', current_date, 'location_code', 'BY',
    'data', jsonb_build_object('supplier', 'Test', 'paid', 'unpaid', 'no_receipt_reason', 'test'),
    'lines', jsonb_build_array(jsonb_build_object('item_id', g.id, 'qty', 2.5, 'unit', 'kg', 'amount', 1000))));
  out := out || format('2.5 kg stored=%s g entered=%s; ', public.on_hand(g.id, 'BY'),
    (select extra -> 'entered' from public.doc_lines where doc_id = d.id));
  d := public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'purchase', 'doc_date', current_date, 'location_code', 'BY',
    'data', jsonb_build_object('supplier', 'Test', 'paid', 'unpaid', 'no_receipt_reason', 'test'),
    'lines', jsonb_build_array(jsonb_build_object('item_id', lb.id, 'qty', 1, 'unit', 'pack', 'amount', 100))));
  out := out || format('1 pack labels=%s pc; ', public.on_hand(lb.id, 'BY'));
  begin
    perform public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'purchase', 'doc_date', current_date, 'location_code', 'BY',
      'data', jsonb_build_object('supplier', 'Test', 'paid', 'unpaid', 'no_receipt_reason', 'test'),
      'lines', jsonb_build_array(jsonb_build_object('item_id', ro.id, 'qty', 1, 'unit', 'L', 'amount', 1))));
    out := out || 'mass as litres ACCEPTED (bad); ';
  exception when others then out := out || format('mass as litres refused (%s); ', sqlerrm); end;
  begin
    perform public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'purchase', 'doc_date', current_date, 'location_code', 'BY',
      'data', jsonb_build_object('supplier', 'Test', 'paid', 'unpaid', 'no_receipt_reason', 'test'),
      'lines', jsonb_build_array(jsonb_build_object('item_id', g.id, 'qty', 1, 'unit', 'pack', 'amount', 1))));
    out := out || 'unconfigured pack ACCEPTED (bad); ';
  exception when others then out := out || format('unconfigured pack refused (%s); ', sqlerrm); end;

  -- ===== member: output first, materials later =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_m, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  b := public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'production', 'doc_date', current_date, 'location_code', 'BY',
    'data', jsonb_build_object('kind', 'brew'), 'lines', jsonb_build_array(jsonb_build_object('item_id', cb.id, 'qty', 5, 'dir', 'out'))));
  out := out || format('batch %s materials=%s output=%s cost=%s; ', b.status, b.data ->> 'materials', public.on_hand(cb.id, 'BY'),
    coalesce((select unit_cost::text from public.stock_moves where doc_id = b.id), 'unknown'));
  c1 := public.add_batch_consumption(jsonb_build_object('client_key', k, 'batch_id', b.id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', ro.id, 'qty', 375, 'unit', 'g'))));
  c2 := public.add_batch_consumption(jsonb_build_object('client_key', k, 'batch_id', b.id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', ro.id, 'qty', 375, 'unit', 'g'))));
  out := out || format('375 g from zero: balance=%s provisional=%s retry same=%s output still=%s; ', public.on_hand(ro.id, 'BY'),
    (select provisional from public.stock_moves where doc_id = c1.id), c1.id = c2.id, public.on_hand(cb.id, 'BY'));
  begin
    perform public.add_batch_consumption(jsonb_build_object('client_key', gen_random_uuid(), 'batch_id', b.id,
      'lines', jsonb_build_array(jsonb_build_object('item_id', ro.id, 'qty', 0.375, 'unit', 'kg'))));
    out := out || 'identical entry ACCEPTED (bad); ';
  exception when others then out := out || format('identical entry refused (%s); ', sqlerrm); end;
  perform public.add_batch_consumption(jsonb_build_object('client_key', gen_random_uuid(), 'batch_id', b.id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', lb.id, 'qty', 5))));
  out := out || format('labels after use=%s; ', public.on_hand(lb.id, 'BY'));
  b := public.complete_batch(b.id, null);
  out := out || format('complete: materials=%s cost_status=%s batch_cost=%s; ', b.data ->> 'materials', b.data ->> 'cost_status', coalesce(b.data ->> 'batch_cost', 'null'));
  begin perform public.complete_batch(b.id, null); out := out || 'complete twice ACCEPTED (bad); ';
  exception when others then out := out || format('complete twice refused (%s); ', sqlerrm); end;

  -- ===== owner: the genuine 1 kg receipt =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'purchase', 'doc_date', current_date, 'location_code', 'BY',
    'data', jsonb_build_object('supplier', 'Test', 'paid', 'unpaid', 'no_receipt_reason', 'test'),
    'lines', jsonb_build_array(jsonb_build_object('item_id', ro.id, 'qty', 1, 'unit', 'kg', 'amount', 600))));
  select avg_cost into n from public.item_costs where item_id = ro.id;
  out := out || format('after 1 kg receipt: balance=%s avg=%s value=%s; ', public.on_hand(ro.id, 'BY'), round(n, 4),
    (select value from public.stock_on_hand where item_id = ro.id and location_code = 'BY'));

  -- ===== green beans in a brew batch: warning, still saved =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_m, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  b := public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'production', 'doc_date', current_date, 'location_code', 'BY',
    'data', jsonb_build_object('kind', 'brew'), 'lines', jsonb_build_array(jsonb_build_object('item_id', cb.id, 'qty', 2, 'dir', 'out'))));
  c1 := public.add_batch_consumption(jsonb_build_object('client_key', gen_random_uuid(), 'batch_id', b.id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', g.id, 'qty', 100))));
  out := out || format('green in brew warning=%s; ', c1.data -> 'warnings');
  begin perform public.reverse_document(b.id, current_date, 'test'); out := out || 'reverse batch with materials ACCEPTED (bad); ';
  exception when others then out := out || format('reverse batch with materials refused (%s); ', sqlerrm); end;

  -- ===== sale of the batch output: unknown cost means no profit =====
  perform public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'sale', 'doc_date', current_date, 'location_code', 'BY',
    'data', jsonb_build_object('channel', 'SHOP-CK', 'paid', 'CASH-CK'), 'lines', jsonb_build_array(jsonb_build_object('item_id', cb.id, 'qty', 2, 'unit_price', 150))));
  s := public.business_report(current_date, current_date);
  out := out || format('report: sales=%s cogs=%s profit=%s missing=%s negative_stock=%s batches_pending=%s; ',
    s ->> 'net_sales', coalesce(s ->> 'cogs', 'null'), coalesce(s ->> 'profit', 'null'), s ->> 'profit_missing', s ->> 'negative_stock', s ->> 'batches_pending');

  -- ===== adjustments need a reason =====
  begin
    perform public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'adjustment', 'doc_date', current_date, 'location_code', 'BY',
      'lines', jsonb_build_array(jsonb_build_object('item_id', lb.id, 'qty', -3))));
    out := out || 'adjustment without reason ACCEPTED (bad); ';
  exception when others then out := out || format('adjustment without reason refused (%s); ', sqlerrm); end;
  d := public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'adjustment', 'doc_date', current_date, 'location_code', 'BY',
    'data', jsonb_build_object('reason', 'damaged'), 'lines', jsonb_build_array(jsonb_build_object('item_id', lb.id, 'qty', -3))));
  out := out || format('member adjustment=%s; ', d.status);

  -- ===== owner: archive keeps history; delete only unused =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  g := public.archive_item(g.id, true);
  out := out || format('archived active=%s moves kept=%s; ', g.active, (select count(*) from public.stock_moves where item_id = g.id));
  begin
    perform public.post_document(jsonb_build_object('client_key', gen_random_uuid(), 'doc_type', 'purchase', 'doc_date', current_date, 'location_code', 'BY',
      'data', jsonb_build_object('supplier', 'Test', 'paid', 'unpaid', 'no_receipt_reason', 'test'),
      'lines', jsonb_build_array(jsonb_build_object('item_id', g.id, 'qty', 1, 'amount', 1))));
    out := out || 'archived item in new entry ACCEPTED (bad); ';
  exception when others then out := out || format('archived item in new entry refused (%s); ', sqlerrm); end;
  out := out || format('owner may remove used=%s unused=%s; ', private.is_owner() and not private.item_used(g.id), private.is_owner() and not private.item_used(un.id));
  begin update public.members set role = 'owner' where user_id = u_m; out := out || 'grant owner role ran (bad); ';
  exception when others then out := out || format('grant owner role refused (%s); ', sqlerrm); end;

  -- ===== a member row that says "owner" is not the owner =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_fake, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  out := out || format('fake owner is_owner=%s; ', private.is_owner());
  begin perform public.archive_item(lb.id, true); out := out || 'fake owner archive ACCEPTED (bad); ';
  exception when others then out := out || format('fake owner archive refused (%s); ', sqlerrm); end;
  execute 'reset role';

  raise exception 'TEST REPORT (rolled back): %', out;
end
$test$;
