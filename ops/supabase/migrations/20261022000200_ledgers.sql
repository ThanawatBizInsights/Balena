-- Balena operations: stock items, prices and the three ledgers (stock, money, partners).
-- Ledger rows are append-only: nobody can edit or delete them. A mistake is fixed by a
-- reversal that adds the opposite rows, so the history always shows both.

-- ---------- stock items (ingredients, packaging, roasted beans and sellable products) ----------

create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_th text not null,
  kind text not null check (kind in ('green_bean', 'roasted_bean', 'ingredient', 'packaging', 'product')),
  base_unit text not null check (base_unit in ('g', 'mL', 'pc')),
  -- products only
  category text check (category in ('beans', 'cold_brew', 'other')),
  size_value numeric(10,2) check (size_value > 0),
  size_unit text check (size_unit in ('g', 'mL')),
  pack text check (pack in ('bag', 'pouch', 'bottle')),
  size_confirmed boolean not null default false,
  iconsiam_code text unique,
  barcode text,
  min_level numeric(14,3),
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  check (kind <> 'product' or (base_unit = 'pc' and category is not null))
);
comment on column public.stock_items.size_confirmed is 'False when the size is a default the owner set, not read from a label.';

create table public.unit_conversions (
  item_id uuid not null references public.stock_items (id),
  unit text not null,
  factor numeric(14,4) not null check (factor > 0),
  primary key (item_id, unit)
);
comment on table public.unit_conversions is 'Purchase units, e.g. 1 box = 100 pc. kg/L are converted in the app (x1000).';

create table public.prices (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.stock_items (id),
  channel_code text not null references public.channels (code),
  price numeric(12,2) not null check (price >= 0),
  valid_from date not null,
  valid_to date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  source text,
  proposed_by uuid references public.members (id),
  approved_by uuid references public.members (id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index prices_lookup on public.prices (item_id, channel_code, valid_from desc) where status = 'approved';

-- Keeps the master data version number moving so the app can detect two people editing at once.
create or replace function private.bump_version() returns trigger language plpgsql set search_path = '' as $$
begin
  if new is distinct from old then new.version := old.version + 1; end if;
  return new;
end $$;
create trigger bump_version before update on public.stock_items for each row execute function private.bump_version();
create trigger audit after insert or update or delete on public.stock_items for each row execute function private.audit();
create trigger audit after insert or update or delete on public.unit_conversions for each row execute function private.audit();
create trigger audit after insert or update or delete on public.prices for each row execute function private.audit();

-- ---------- reporting periods ----------

create table public.periods (
  month date primary key check (extract(day from month) = 1),
  closed_at timestamptz,
  closed_by uuid references public.members (id)
);
create trigger audit after insert or update or delete on public.periods for each row execute function private.audit();

create or replace function private.assert_open(p_date date) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_date is null then perform private.fail('date_required'); end if;
  if p_date > (now() at time zone 'Asia/Bangkok')::date + 1 then
    perform private.fail('date_future', jsonb_build_object('date', p_date));
  end if;
  if exists (select 1 from public.periods where month = date_trunc('month', p_date)::date and closed_at is not null) then
    perform private.fail('period_closed', jsonb_build_object('date', p_date));
  end if;
end $$;

-- ---------- stock ledger ----------

create table public.item_costs (
  item_id uuid primary key references public.stock_items (id),
  qty numeric(16,3) not null default 0,
  avg_cost numeric(18,6)
);
comment on table public.item_costs is 'Company-wide quantity and moving average cost per base unit. Null cost = not known yet.';

create table public.stock_moves (
  id bigint generated always as identity primary key,
  move_date date not null,
  item_id uuid not null references public.stock_items (id),
  location_code text not null references public.locations (code),
  qty numeric(14,3) not null check (qty <> 0),
  unit_cost numeric(18,6),
  value numeric(18,4) generated always as (qty * unit_cost) stored,
  kind text not null,
  doc_type text not null,
  doc_id uuid not null,
  reverses bigint references public.stock_moves (id),
  created_by uuid references public.members (id),
  created_at timestamptz not null default now()
);
create index stock_moves_item_loc on public.stock_moves (item_id, location_code);
create index stock_moves_doc on public.stock_moves (doc_type, doc_id);
create index stock_moves_date on public.stock_moves (move_date);

create or replace function private.no_change() returns trigger language plpgsql set search_path = '' as $$
begin
  perform private.fail('ledger_locked');
  return null;
end $$;
create trigger no_change before update or delete on public.stock_moves for each row execute function private.no_change();

create or replace function public.on_hand(p_item uuid, p_location text) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(qty), 0) from public.stock_moves where item_id = p_item and location_code = p_location
$$;

-- One stock movement. Receipts with a cost update the moving average; everything else moves at
-- the current average. Stock at a location can't go below zero.
create or replace function private.move(
  p_date date, p_item uuid, p_location text, p_qty numeric, p_kind text,
  p_doc_type text, p_doc_id uuid, p_unit_cost numeric default null, p_reverses bigint default null
) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  c public.item_costs;
  cost numeric;
  have numeric;
  item_name text;
begin
  perform private.assert_open(p_date);
  insert into public.item_costs (item_id) values (p_item) on conflict do nothing;
  select * into c from public.item_costs where item_id = p_item for update;

  if p_qty < 0 then
    have := public.on_hand(p_item, p_location);
    if have + p_qty < 0 then
      select name_en into item_name from public.stock_items where id = p_item;
      perform private.fail('stock_short', jsonb_build_object('item', item_name, 'location', p_location, 'have', have, 'need', -p_qty));
    end if;
    if p_unit_cost is not null then
      -- Reversing a costed receipt: take its own cost back out of the average.
      cost := p_unit_cost;
      if c.qty + p_qty > 0 and c.avg_cost is not null then
        update public.item_costs set avg_cost = (c.qty * c.avg_cost + p_qty * p_unit_cost) / (c.qty + p_qty) where item_id = p_item;
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
  insert into public.stock_moves (move_date, item_id, location_code, qty, unit_cost, kind, doc_type, doc_id, reverses, created_by)
  values (p_date, p_item, p_location, p_qty, cost, p_kind, p_doc_type, p_doc_id, p_reverses, private.member_id());
  return cost;
end $$;

-- ---------- money ledger ----------

create table public.money_moves (
  id bigint generated always as identity primary key,
  move_date date not null,
  account_code text not null references public.accounts (code),
  amount numeric(14,2) not null check (amount <> 0),
  kind text not null,
  doc_type text not null,
  doc_id uuid not null,
  reverses bigint references public.money_moves (id),
  created_by uuid references public.members (id),
  created_at timestamptz not null default now()
);
create index money_moves_account on public.money_moves (account_code, move_date);
create index money_moves_doc on public.money_moves (doc_type, doc_id);
create trigger no_change before update or delete on public.money_moves for each row execute function private.no_change();

create or replace function private.money(p_date date, p_account text, p_amount numeric, p_kind text, p_doc_type text, p_doc_id uuid, p_reverses bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_open(p_date);
  insert into public.money_moves (move_date, account_code, amount, kind, doc_type, doc_id, reverses, created_by)
  values (p_date, p_account, p_amount, p_kind, p_doc_type, p_doc_id, p_reverses, private.member_id());
end $$;

-- ---------- partner ledger ----------
-- contribution (+) and drawing (-) are equity; paid_for_business (+) and reimbursed (-) are what
-- the business owes a partner who paid with their own money.

create table public.partner_moves (
  id bigint generated always as identity primary key,
  move_date date not null,
  member_id uuid not null references public.members (id),
  amount numeric(14,2) not null check (amount <> 0),
  kind text not null check (kind in ('contribution', 'drawing', 'paid_for_business', 'reimbursed')),
  doc_type text not null,
  doc_id uuid not null,
  reverses bigint references public.partner_moves (id),
  created_by uuid references public.members (id),
  created_at timestamptz not null default now()
);
create trigger no_change before update or delete on public.partner_moves for each row execute function private.no_change();

create or replace function private.partner(p_date date, p_member uuid, p_amount numeric, p_kind text, p_doc_type text, p_doc_id uuid, p_reverses bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_open(p_date);
  insert into public.partner_moves (move_date, member_id, amount, kind, doc_type, doc_id, reverses, created_by)
  values (p_date, p_member, p_amount, p_kind, p_doc_type, p_doc_id, p_reverses, private.member_id());
end $$;
