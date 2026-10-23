-- Checks the sales-report import and the business report. Fictional figures only (this repo is
-- public); the real report lives in the database. Rolls itself back: it ends by raising its report.
do $test$
declare
  p jsonb := '{"channel":"ICONSIAM","location_code":"ICS","report_no":"TEST-0001","branch_code":"9999","branch_name":"TEST BRANCH",
    "period_start":"2026-07-01","period_end":"2026-07-31","generated_at":"2026-09-05T10:00:00+07:00","gp_percent":25,
    "totals":{"units":7,"net_sales":1500,"gp_amount":375,"supplier_amount":1125,"vat_amount":0},
    "method":"test","source":{"file":"test"},
    "lines":[
      {"item_code":"TEST-A","barcode":"","description":"Test item A","qty":4,"unit_price":250,"sales_amount":1000,"discount":0,"net_sales":1000,"supplier_amount":750},
      {"item_code":"TEST-B","barcode":"","description":"Test item B","qty":3,"unit_price":200,"sales_amount":600,"discount":100,"net_sales":500,"supplier_amount":375}]}';
  u_owner uuid := gen_random_uuid();
  u_member uuid := gen_random_uuid();
  d public.documents; d2 public.documents;
  s jsonb; n numeric; out text := '';
begin
  insert into auth.users (id, email, aud, role, instance_id, email_confirmed_at) values
    (u_owner, 'test-admin@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', now()),
    (u_member, 'test-member@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', now());
  insert into public.members (email, display_name, role) values ('test-admin@example.test', 'Test admin', 'owner');
  insert into public.members (email, display_name) values ('test-member@example.test', 'Test member');
  out := out || format('linked=%s default role=%s; ',
    (select count(*) from public.members where user_id in (u_owner, u_member)),
    (select role from public.members where user_id = u_member));

  -- a team member imports: waits for approval, unknown codes become inactive historical products
  perform set_config('request.jwt.claims', json_build_object('sub', u_member, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.import_sales_report(jsonb_set(p, '{lines,0,supplier_amount}', '751'));
    out := out || 'tampered line ACCEPTED (bad); ';
  exception when others then out := out || format('tampered line refused (%s); ', sqlerrm); end;
  begin perform public.import_sales_report(jsonb_set(p, '{totals,units}', '8'));
    out := out || 'wrong total ACCEPTED (bad); ';
  exception when others then out := out || format('wrong total refused (%s); ', sqlerrm); end;
  d := public.import_sales_report(p);
  d2 := public.import_sales_report(p);
  out := out || format('import %s date=%s idempotent=%s; ', d.status, d.doc_date, d.id = d2.id);
  begin perform public.decide_document(d.id, true, null); out := out || 'member approve ACCEPTED (bad); ';
  exception when others then out := out || format('member approve refused (%s); ', sqlerrm); end;

  -- the administrator approves
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  d := public.decide_document(d.id, true, null);
  select count(*) into n from public.stock_items where code like 'LEGACY-ICONSIAM-TEST-%' and not active;
  out := out || format('approved=%s legacy items=%s stock moves=%s money moves=%s; ', d.status, n,
    (select count(*) from public.stock_moves where doc_id = d.id), (select count(*) from public.money_moves where doc_id = d.id));
  s := public.business_report('2026-07-01', '2026-07-31');
  out := out || format('report units=%s gross=%s discounts=%s net=%s gp=%s after=%s open=%s unconfirmed=%s profit=%s missing=%s; ',
    s ->> 'units', s ->> 'gross_sales', s ->> 'discounts', s ->> 'net_sales', s ->> 'gp', s ->> 'after_channel',
    s -> 'receivable' ->> 'open', s -> 'receivable' ->> 'unconfirmed_count', coalesce(s ->> 'profit', 'null'), s ->> 'profit_missing');
  s := public.business_report('2026-09-01', '2026-09-30');
  out := out || format('generation month net=%s; ', s ->> 'net_sales');

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin perform public.business_report('2026-07-01', '2026-07-31'); out := out || 'anon report ran (bad); ';
  exception when others then out := out || format('anon refused (%s); ', sqlerrm); end;
  execute 'reset role';

  raise exception 'TEST REPORT (rolled back): %', out;
end
$test$;
