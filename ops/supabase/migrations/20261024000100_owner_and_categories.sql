-- Trusted owner account, item categories and item management.
--
-- Owner: the app's owner is identified only by the signed-in login (auth.uid(), from the verified
-- token) appearing in private.owner_accounts. That table is not reachable through the API and is
-- not editable from the app; display names, member rows and browser storage play no part. The
-- members.role value 'owner' can no longer be set from the app.
--
-- Categories: every item belongs to a category; each category holds one kind of stock item, so an
-- item can only move to a category of the same kind (raw beans, bulk roasted beans and retail bags
-- stay separate stock items). System categories can be renamed but not deleted.
--
-- Items: written only through save_item() and archive_item(). Any active member may add items and
-- make normal edits (names, pack size, reorder level, barcode). Category moves, code, base unit,
-- entry-unit conversions and archiving are owner-only. Permanent removal is a row-level rule: only
-- the owner, only for items nothing refers to. Item ids never change.
--
-- Applied to the project in smaller steps (owner_account_and_categories ... packaging_items) because
-- the migration tool times out on long requests; the statements are the same as below.

-- ---------- trusted owner ----------

create table private.owner_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
revoke all on private.owner_accounts from public, anon, authenticated;
-- Carry over the current owner login (the account already linked to the owner member).
insert into private.owner_accounts (user_id)
select user_id from public.members where role = 'owner' and user_id is not null and active
on conflict do nothing;

create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.owner_accounts o join public.members m on m.user_id = o.user_id and m.active
    where o.user_id = auth.uid())
$$;

-- Role as the rest of the database sees it: 'owner' only from the trusted table.
create or replace function private.member_role() returns text
language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from private.owner_accounts where user_id = auth.uid()) then 'owner'
              when m.role = 'owner' then 'partner' else m.role end
  from public.members m where m.user_id = auth.uid() and m.active
$$;

-- The app may not hand out the owner role.
-- Runs with the caller's rights so it can see who is calling; private.fail only raises an error,
-- so signed-in users may call it to receive the clear 'owner_only' message.
grant execute on function private.fail(text, jsonb) to authenticated;
create or replace function private.guard_member_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and new.role = 'owner'
     and (tg_op = 'INSERT' or old.role is distinct from 'owner') then
    perform private.fail('owner_only');
  end if;
  return new;
end $$;
create trigger guard_member_role before insert or update on public.members
  for each row execute function private.guard_member_role();

-- ---------- categories ----------

create table public.item_categories (
  code text primary key check (code ~ '^[A-Z0-9][A-Z0-9-]{1,39}$'),
  parent_code text references public.item_categories (code),
  name_th text not null check (btrim(name_th) <> ''),
  name_en text not null check (btrim(name_en) <> ''),
  kind text not null check (kind in ('green_bean', 'roasted_bean', 'ingredient', 'packaging', 'product', 'consumable')),
  product_group text check (product_group in ('beans', 'cold_brew', 'other')),
  system boolean not null default false,
  sort integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'product' or product_group is not null)
);
comment on table public.item_categories is 'Item catalogue groups. One stock kind per category; items move only between categories of the same kind.';

insert into public.item_categories (code, parent_code, name_th, name_en, kind, product_group, system, sort) values
  ('RAW', null, 'วัตถุดิบ', 'Raw materials', 'ingredient', null, true, 10),
  ('RAW-GREEN', 'RAW', 'สารกาแฟ (เมล็ดดิบ)', 'Green coffee', 'green_bean', null, true, 11),
  ('ROAST', null, 'กาแฟคั่วสำหรับผลิต', 'Roasted coffee inputs', 'roasted_bean', null, true, 20),
  ('FIN', null, 'สินค้าสำเร็จรูป', 'Finished products', 'product', 'other', true, 30),
  ('FIN-COLDBREW', 'FIN', 'Cold Brew', 'Cold Brew', 'product', 'cold_brew', true, 31),
  ('FIN-BEANS', 'FIN', 'เมล็ดกาแฟคั่ว (ถุงขาย)', 'Roasted beans (retail bags)', 'product', 'beans', true, 32),
  ('PACK', null, 'บรรจุภัณฑ์', 'Packaging', 'packaging', null, true, 40),
  ('CONS', null, 'วัสดุสิ้นเปลือง', 'Consumables', 'consumable', null, true, 50)
on conflict (code) do nothing;

alter table public.item_categories enable row level security;
revoke all on public.item_categories from anon, authenticated;
grant select on public.item_categories to authenticated;
create policy read on public.item_categories for select to authenticated using (private.is_member());
create trigger audit after insert or update or delete on public.item_categories for each row execute function private.audit();

-- ---------- items: consumable kind, category ----------

alter table public.stock_items drop constraint stock_items_kind_check;
alter table public.stock_items add constraint stock_items_kind_check
  check (kind in ('green_bean', 'roasted_bean', 'ingredient', 'packaging', 'product', 'consumable'));
alter table public.stock_items add column category_code text references public.item_categories (code);
alter table public.stock_items add column pack_note text;
comment on column public.stock_items.pack_note is 'Free-text pack size or specification (e.g. "100 pcs per roll"), only when known.';

update public.stock_items set category_code = case
    when kind = 'green_bean' then 'RAW-GREEN'
    when kind = 'ingredient' then 'RAW'
    when kind = 'roasted_bean' then 'ROAST'
    when kind = 'packaging' then 'PACK'
    when kind = 'consumable' then 'CONS'
    when kind = 'product' and category = 'cold_brew' then 'FIN-COLDBREW'
    when kind = 'product' and category = 'beans' then 'FIN-BEANS'
    else 'FIN' end
where category_code is null;
alter table public.stock_items alter column category_code set not null;
create index stock_items_category on public.stock_items (category_code);

-- Category must hold the item's kind; products take their product group from the category.
create or replace function private.item_category_check() returns trigger
language plpgsql set search_path = '' as $$
declare c public.item_categories;
begin
  select * into c from public.item_categories where code = new.category_code;
  if not found or c.kind <> new.kind then
    perform private.fail('category_incompatible', jsonb_build_object('category', new.category_code, 'kind', new.kind));
  end if;
  if new.kind = 'product' then
    new.category := c.product_group;
    new.base_unit := 'pc';
  end if;
  return new;
end $$;
create trigger item_category_check before insert or update on public.stock_items
  for each row execute function private.item_category_check();

-- History keeps the item as it was named when the record was made.
create or replace function private.line_item_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
declare i public.stock_items;
begin
  if new.item_id is not null then
    select * into i from public.stock_items where id = new.item_id;
    new.extra := new.extra || jsonb_build_object('item_snapshot',
      jsonb_build_object('code', i.code, 'name_th', i.name_th, 'name_en', i.name_en, 'base_unit', i.base_unit));
  end if;
  return new;
end $$;
create trigger line_item_snapshot before insert on public.doc_lines
  for each row execute function private.line_item_snapshot();

-- ---------- item writes go through functions only ----------

alter policy owner_insert on public.stock_items with check (false);
alter policy owner_update on public.stock_items using (false) with check (false);
alter policy owner_insert on public.unit_conversions with check (false);
alter policy owner_update on public.unit_conversions using (false) with check (false);
revoke insert, update, delete on public.stock_items, public.unit_conversions from authenticated;

create or replace function private.item_used(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.doc_lines where item_id = p_item)
      or exists (select 1 from public.stock_moves where item_id = p_item)
      or exists (select 1 from public.prices where item_id = p_item)
$$;

-- Named entry units (pack, roll, box...) and their factor to the base unit. g/kg/mL/L/pc are built in.
create or replace function private.set_conversions(p_item uuid, p_units jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare u jsonb;
begin
  for u in select * from jsonb_array_elements(coalesce(p_units, '[]'::jsonb)) loop
    perform private.require(coalesce(btrim(u ->> 'unit'), '') <> '' and lower(u ->> 'unit') not in ('g', 'kg', 'ml', 'l', 'pc', 'pcs'),
      'unit_invalid', jsonb_build_object('unit', u ->> 'unit'));
    perform private.require(coalesce((u ->> 'factor')::numeric, 0) > 0, 'unit_factor_required', jsonb_build_object('unit', u ->> 'unit'));
  end loop;
  perform private.clear_conversions(p_item, p_units);
  insert into public.unit_conversions (item_id, unit, factor)
  select p_item, btrim(x ->> 'unit'), (x ->> 'factor')::numeric from jsonb_array_elements(coalesce(p_units, '[]'::jsonb)) x
  on conflict (item_id, unit) do update set factor = excluded.factor;
end $$;

-- Removes entry units that are no longer listed for an item.
create or replace function private.clear_conversions(p_item uuid, p_units jsonb) returns void
language sql security definer set search_path = '' as $$
  delete from public.unit_conversions where item_id = p_item
    and unit not in (select btrim(x ->> 'unit') from jsonb_array_elements(coalesce(p_units, '[]'::jsonb)) x)
$$;

-- Add or edit an item. Any active member: add items, edit names, pack size, reorder level, barcode.
-- Owner only (trusted account): move category, change code or base unit, change entry units.
-- A used item keeps its code and base unit: stored quantities are never reinterpreted.
create or replace function public.save_item(p jsonb) returns public.stock_items
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.member_id();
  owner boolean := private.is_owner();
  cur public.stock_items;
  r public.stock_items;
  cat public.item_categories;
  used boolean;
  units_changed boolean;
begin
  perform private.require(me is not null, 'not_member');
  perform private.require(coalesce(btrim(p ->> 'name_th'), '') <> '' and coalesce(btrim(p ->> 'name_en'), '') <> '', 'item_name_required');

  if (p ->> 'id') is null then
    select * into cat from public.item_categories where code = p ->> 'category_code' and active;
    perform private.require(found, 'category_required');
    perform private.require(coalesce(p ->> 'code', '') ~ '^[A-Za-z0-9][A-Za-z0-9-]{1,39}$', 'item_code_invalid');
    perform private.require(not exists (select 1 from public.stock_items where upper(code) = upper(p ->> 'code')), 'item_code_taken', jsonb_build_object('code', p ->> 'code'));
    perform private.require(cat.kind = 'product' or p ->> 'base_unit' in ('g', 'mL', 'pc'), 'unit_invalid', jsonb_build_object('unit', p ->> 'base_unit'));
    insert into public.stock_items (code, name_th, name_en, kind, base_unit, category_code, category, size_value, size_unit, pack,
      size_confirmed, pack_note, barcode, min_level)
    values (upper(p ->> 'code'), btrim(p ->> 'name_th'), btrim(p ->> 'name_en'), cat.kind,
      case when cat.kind = 'product' then 'pc' else p ->> 'base_unit' end, cat.code, cat.product_group,
      nullif(p ->> 'size_value', '')::numeric, nullif(p ->> 'size_unit', ''), nullif(p ->> 'pack', ''),
      coalesce((p ->> 'size_confirmed')::boolean, false), nullif(btrim(p ->> 'pack_note'), ''), nullif(btrim(p ->> 'barcode'), ''),
      nullif(p ->> 'min_level', '')::numeric)
    returning * into r;
    perform private.set_conversions(r.id, p -> 'units');
    return r;
  end if;

  select * into cur from public.stock_items where id = (p ->> 'id')::uuid for update;
  perform private.require(found, 'not_found');
  perform private.require((p ->> 'version') is null or (p ->> 'version')::integer = cur.version, 'edited_elsewhere');
  used := private.item_used(cur.id);
  units_changed := (p ? 'units') and coalesce((select jsonb_agg(jsonb_build_object('unit', unit, 'factor', factor::numeric) order by unit) from public.unit_conversions where item_id = cur.id), '[]'::jsonb)
    is distinct from coalesce((select jsonb_agg(jsonb_build_object('unit', btrim(x ->> 'unit'), 'factor', (x ->> 'factor')::numeric) order by btrim(x ->> 'unit')) from jsonb_array_elements(p -> 'units') x), '[]'::jsonb);

  if (p ? 'category_code' and p ->> 'category_code' <> cur.category_code)
     or (p ? 'base_unit' and p ->> 'base_unit' <> cur.base_unit)
     or (p ? 'code' and upper(p ->> 'code') <> cur.code)
     or units_changed then
    perform private.require(owner, 'owner_only');
  end if;
  if p ? 'code' and upper(p ->> 'code') <> cur.code then
    perform private.require(not used, 'item_code_locked');
    perform private.require(p ->> 'code' ~ '^[A-Za-z0-9][A-Za-z0-9-]{1,39}$', 'item_code_invalid');
    perform private.require(not exists (select 1 from public.stock_items where upper(code) = upper(p ->> 'code')), 'item_code_taken', jsonb_build_object('code', p ->> 'code'));
  end if;
  if p ? 'base_unit' and p ->> 'base_unit' <> cur.base_unit then
    perform private.require(not used, 'unit_change_needs_migration');
    perform private.require(p ->> 'base_unit' in ('g', 'mL', 'pc') and cur.kind <> 'product', 'unit_invalid');
  end if;
  if p ? 'category_code' and p ->> 'category_code' <> cur.category_code then
    select * into cat from public.item_categories where code = p ->> 'category_code' and active;
    perform private.require(found and cat.kind = cur.kind, 'category_incompatible');
  end if;

  update public.stock_items set
    name_th = btrim(p ->> 'name_th'),
    name_en = btrim(p ->> 'name_en'),
    code = case when p ? 'code' then upper(p ->> 'code') else code end,
    category_code = coalesce(p ->> 'category_code', category_code),
    base_unit = coalesce(p ->> 'base_unit', base_unit),
    size_value = case when p ? 'size_value' then nullif(p ->> 'size_value', '')::numeric else size_value end,
    size_unit = case when p ? 'size_unit' then nullif(p ->> 'size_unit', '') else size_unit end,
    pack = case when p ? 'pack' then nullif(p ->> 'pack', '') else pack end,
    pack_note = case when p ? 'pack_note' then nullif(btrim(p ->> 'pack_note'), '') else pack_note end,
    barcode = case when p ? 'barcode' then nullif(btrim(p ->> 'barcode'), '') else barcode end,
    min_level = case when p ? 'min_level' then nullif(p ->> 'min_level', '')::numeric else min_level end
  where id = cur.id
  returning * into r;
  if units_changed then perform private.set_conversions(r.id, p -> 'units'); end if;
  return r;
end $$;

-- Archive (hide from new entries, keep all history) or restore. Owner only.
create or replace function public.archive_item(p_id uuid, p_archived boolean default true) returns public.stock_items
language plpgsql security definer set search_path = '' as $$
declare r public.stock_items;
begin
  perform private.require(private.is_owner(), 'owner_only');
  update public.stock_items set active = not p_archived where id = p_id returning * into r;
  perform private.require(found, 'not_found');
  return r;
end $$;

create or replace function public.save_category(p jsonb) returns public.item_categories
language plpgsql security definer set search_path = '' as $$
declare cur public.item_categories; r public.item_categories; par public.item_categories;
begin
  perform private.require(private.is_owner(), 'owner_only');
  perform private.require(coalesce(btrim(p ->> 'name_th'), '') <> '' and coalesce(btrim(p ->> 'name_en'), '') <> '', 'item_name_required');
  select * into cur from public.item_categories where code = upper(p ->> 'code');
  if not found then
    perform private.require(upper(coalesce(p ->> 'code', '')) ~ '^[A-Z0-9][A-Z0-9-]{1,39}$', 'item_code_invalid');
    if nullif(p ->> 'parent_code', '') is not null then
      select * into par from public.item_categories where code = p ->> 'parent_code';
      perform private.require(found and par.parent_code is null, 'category_required');
    end if;
    perform private.require(p ->> 'kind' in ('green_bean', 'roasted_bean', 'ingredient', 'packaging', 'product', 'consumable'), 'category_kind_required');
    insert into public.item_categories (code, parent_code, name_th, name_en, kind, product_group, sort)
    values (upper(p ->> 'code'), nullif(p ->> 'parent_code', ''), btrim(p ->> 'name_th'), btrim(p ->> 'name_en'), p ->> 'kind',
      case when p ->> 'kind' = 'product' then coalesce(nullif(p ->> 'product_group', ''), 'other') end, coalesce((p ->> 'sort')::integer, 100))
    returning * into r;
  else
    -- The kind of a category can't change once it holds items; system categories keep their kind.
    if p ? 'kind' and p ->> 'kind' <> cur.kind then
      perform private.require(not cur.system and not exists (select 1 from public.stock_items where category_code = cur.code), 'category_in_use');
    end if;
    update public.item_categories set name_th = btrim(p ->> 'name_th'), name_en = btrim(p ->> 'name_en'),
      kind = coalesce(p ->> 'kind', kind), sort = coalesce((p ->> 'sort')::integer, sort),
      active = case when system then true else coalesce((p ->> 'active')::boolean, active) end
    where code = cur.code returning * into r;
  end if;
  return r;
end $$;

-- Permanent removal is a row-level rule rather than a function: only the trusted owner login may
-- remove an item that nothing refers to (no records, stock moves or prices), its entry units, or an
-- empty non-system category. Requests from anyone else match no rows.
grant execute on function private.item_used(uuid) to authenticated;
grant delete on public.stock_items, public.unit_conversions, public.item_categories to authenticated;
create policy owner_remove_unused on public.stock_items for delete to authenticated
  using (private.is_owner() and not private.item_used(id));
create policy owner_remove_unused on public.unit_conversions for delete to authenticated
  using (private.is_owner() and not private.item_used(item_id));
create policy owner_remove_empty on public.item_categories for delete to authenticated
  using (private.is_owner() and not system
    and not exists (select 1 from public.stock_items i where i.category_code = item_categories.code)
    and not exists (select 1 from public.item_categories c where c.parent_code = item_categories.code));

revoke all on function public.save_item(jsonb), public.archive_item(uuid, boolean), public.save_category(jsonb) from public, anon;
grant execute on function public.save_item(jsonb), public.archive_item(uuid, boolean), public.save_category(jsonb) to authenticated;
revoke all on function private.set_conversions(uuid, jsonb), private.clear_conversions(uuid, jsonb),
  private.item_category_check(), private.line_item_snapshot(), private.guard_member_role() from public, anon, authenticated;

-- ---------- packaging (generic; sizes, suppliers, costs and stock are not known) ----------
-- The spout pouch is the 500 mL pouch the cold brew products are sold in. Safe to re-run.

insert into public.stock_items (code, name_th, name_en, kind, base_unit, category_code) values
  ('PK-LABEL', 'ฉลากสินค้า', 'Product labels', 'packaging', 'pc', 'PACK'),
  ('PK-STICKER', 'สติกเกอร์', 'Stickers', 'packaging', 'pc', 'PACK'),
  ('PK-SPOUT-POUCH-500', 'ถุงพวยสำหรับโคลด์บรูว์ 500 มล.', 'Cold brew spout pouch 500 mL', 'packaging', 'pc', 'PACK'),
  ('PK-COFFEE-BAG', 'ถุงกาแฟ', 'Coffee bags', 'packaging', 'pc', 'PACK')
on conflict (code) do nothing;
