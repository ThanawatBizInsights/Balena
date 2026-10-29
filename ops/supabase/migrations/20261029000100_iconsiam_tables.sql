-- ICONSIAM workspace, part 1: tables.
--
-- - channel_profiles: supplier/customer details printed on delivery notes (owner edits; the
--   values live only in the database, never in this public repo).
-- - channel_item_maps: reviewed links from a channel's codes (vendor product code, store item
--   code, barcode) to our items. Imports never match by barcode alone.
-- - consignment_shipments (+ lines): planned → dispatched (in transit) → received (accepted,
--   rejected back to the branch, missing). Planning changes no stock.
-- - sales_updates (+ lines): interim sales (dated intervals, cumulative month-to-date
--   snapshots) and official monthly reports (finals, with revisions). One source = one update.
-- - sales_stock_state: how much of each month's authoritative sales has already reduced stock,
--   was absorbed by a later count, or happened before stock was tracked there.
-- - consignment_plan_settings: per-SKU replenishment settings (4 preparation days by default).
--
-- Writes go only through security definer functions (part 2 and 3); members read.

-- A revised official report replaces the earlier one without deleting it.
alter table public.documents drop constraint documents_status_check;
alter table public.documents add constraint documents_status_check
  check (status in ('pending', 'posted', 'rejected', 'reversed', 'superseded'));

create table public.channel_profiles (
  channel_code text primary key references public.channels (code),
  supplier jsonb not null default '{}'::jsonb,   -- name, vendor_no, address, phone, email
  customer jsonb not null default '{}'::jsonb,   -- name, branch, address, tax_id, store, floor
  gp_percent numeric(5,2) check (gp_percent between 0 and 100),  -- contractual reference only
  delivery_copies integer not null default 4 check (delivery_copies between 1 and 9),
  stock_card_copies integer not null default 1 check (stock_card_copies between 0 and 9),
  updated_by uuid references public.members (id),
  updated_at timestamptz not null default now()
);

create table public.channel_item_maps (
  id uuid primary key default gen_random_uuid(),
  channel_code text not null references public.channels (code),
  source_code text not null,          -- e.g. BA-008 on our delivery form
  barcode text,
  source_name text,
  package_size text,
  item_id uuid references public.stock_items (id),
  status text not null default 'proposed' check (status in ('proposed', 'reviewed', 'needs_review', 'rejected')),
  issues jsonb not null default '[]'::jsonb,
  source_ref text,
  reviewed_by uuid references public.members (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (channel_code, source_code)
);

create table private.ship_counters (year integer primary key, n integer not null default 0);

create table public.consignment_shipments (
  id uuid primary key default gen_random_uuid(),
  ship_no text not null unique,
  channel_code text not null references public.channels (code),
  location_code text not null references public.locations (code),
  from_location text not null references public.locations (code),
  status text not null default 'planned'
    check (status in ('planned', 'dispatched', 'received', 'partly_received', 'cancelled')),
  doc_date date not null,
  planned_dispatch date,
  expected_arrival date,
  dispatched_on date,
  received_on date,
  transfer_doc uuid references public.documents (id),
  gp_percent numeric(5,2),
  signatures jsonb not null default '{}'::jsonb,   -- sender/receiver name and date, signed flag
  receipt_status text not null default 'not_received'
    check (receipt_status in ('not_received', 'received_unsigned', 'confirmed')),
  source jsonb,                                    -- imported form: file, sha256, method
  source_ref text unique,
  attachments text[] not null default '{}',
  note text,
  receipt_note text,
  client_key uuid not null unique,
  created_by uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consignment_shipment_lines (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.consignment_shipments (id),
  line_no integer not null,
  item_id uuid references public.stock_items (id),
  map_id uuid references public.channel_item_maps (id),
  source_code text,
  barcode text,
  description text,
  package_size text,
  qty numeric(14,3) not null check (qty > 0),
  unit_price numeric(14,2) check (unit_price >= 0),    -- the price on this form (historical)
  amount numeric(14,2),
  accepted numeric(14,3),
  rejected numeric(14,3),
  missing numeric(14,3),
  unique (shipment_id, line_no)
);

create table public.sales_updates (
  id uuid primary key default gen_random_uuid(),
  channel_code text not null references public.channels (code),
  location_code text not null references public.locations (code),
  month date not null check (month = date_trunc('month', month)::date),
  kind text not null check (kind in ('interval', 'snapshot', 'final')),
  coverage_start date not null,
  coverage_end date not null,
  as_of date not null,
  version integer not null default 1,
  status text not null default 'active' check (status in ('active', 'superseded')),
  superseded_by uuid references public.sales_updates (id),
  source_ref text not null unique,
  content_hash text not null,
  source jsonb not null default '{}'::jsonb,        -- type, reference, file, sha256, note
  doc_id uuid references public.documents (id),     -- the consignment record of a final report
  gp_percent numeric(5,2),
  totals jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  check (coverage_start <= coverage_end and as_of >= coverage_end
    and coverage_start >= month and coverage_end < (month + interval '1 month')::date)
);
create index sales_updates_month on public.sales_updates (channel_code, location_code, month);

create table public.sales_update_lines (
  update_id uuid not null references public.sales_updates (id),
  line_no integer not null,
  item_id uuid not null references public.stock_items (id),
  source_code text,
  barcode text,
  description text,
  qty numeric(14,3) not null check (qty >= 0),
  unit_price numeric(14,2),
  gross numeric(14,2),
  discount numeric(14,2),
  net numeric(14,2),
  gp_amount numeric(14,2),
  payable numeric(14,2),
  primary key (update_id, line_no),
  unique (update_id, item_id)
);

create table public.sales_stock_state (
  channel_code text not null references public.channels (code),
  location_code text not null references public.locations (code),
  month date not null,
  item_id uuid not null references public.stock_items (id),
  target_qty numeric(14,3) not null default 0,
  deducted_qty numeric(14,3) not null default 0,
  absorbed_qty numeric(14,3) not null default 0,
  untracked_qty numeric(14,3) not null default 0,
  last_as_of date,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (channel_code, location_code, month, item_id)
);

create table public.consignment_plan_settings (
  location_code text not null references public.locations (code),
  item_id uuid not null references public.stock_items (id),
  prep_days integer not null default 4 check (prep_days >= 0),
  transit_days integer check (transit_days >= 0),          -- null = not set yet
  safety_days integer check (safety_days >= 0),
  target_cover_days integer check (target_cover_days > 0),
  pack_multiple integer not null default 1 check (pack_multiple >= 1),
  min_shipment integer not null default 0 check (min_shipment >= 0),
  shelf_life_days integer check (shelf_life_days > 0),
  shelf_life_verified boolean not null default false,
  window_days integer not null default 28 check (window_days between 7 and 120),
  method text not null default 'auto' check (method in ('auto', 'dated', 'monthly', 'manual')),
  manual_daily numeric(10,3) check (manual_daily >= 0),
  manual_note text,
  updated_by uuid references public.members (id),
  updated_at timestamptz not null default now(),
  primary key (location_code, item_id)
);

-- Access: members read; nobody writes directly (functions only).
alter table public.channel_profiles enable row level security;
alter table public.channel_item_maps enable row level security;
alter table public.consignment_shipments enable row level security;
alter table public.consignment_shipment_lines enable row level security;
alter table public.sales_updates enable row level security;
alter table public.sales_update_lines enable row level security;
alter table public.sales_stock_state enable row level security;
alter table public.consignment_plan_settings enable row level security;
alter table private.ship_counters enable row level security;

revoke all on public.channel_profiles, public.channel_item_maps, public.consignment_shipments,
  public.consignment_shipment_lines, public.sales_updates, public.sales_update_lines,
  public.sales_stock_state, public.consignment_plan_settings from anon, authenticated;
revoke all on private.ship_counters from public, anon, authenticated;
grant select on public.channel_profiles, public.channel_item_maps, public.consignment_shipments,
  public.consignment_shipment_lines, public.consignment_plan_settings to authenticated;
-- Sales values are money: visible to the members who see figures.
grant select on public.sales_updates, public.sales_update_lines, public.sales_stock_state to authenticated;

create policy read on public.channel_profiles for select to authenticated using (private.is_member());
create policy read on public.channel_item_maps for select to authenticated using (private.is_member());
create policy read on public.consignment_shipments for select to authenticated using (private.is_member());
create policy read on public.consignment_shipment_lines for select to authenticated using (private.is_member());
create policy read on public.consignment_plan_settings for select to authenticated using (private.is_member());
create policy read on public.sales_updates for select to authenticated using (private.sees_money());
create policy read on public.sales_update_lines for select to authenticated using (private.sees_money());
create policy read on public.sales_stock_state for select to authenticated using (private.sees_money());

create trigger audit after insert or update or delete on public.channel_profiles for each row execute function private.audit();
create trigger audit after insert or update or delete on public.channel_item_maps for each row execute function private.audit();
create trigger audit after insert or update or delete on public.consignment_shipments for each row execute function private.audit();
create trigger audit after insert or update or delete on public.consignment_shipment_lines for each row execute function private.audit();
create trigger audit after insert or update or delete on public.sales_updates for each row execute function private.audit();
create trigger audit after insert or update or delete on public.sales_stock_state for each row execute function private.audit();
create trigger audit after insert or update or delete on public.consignment_plan_settings for each row execute function private.audit();

-- Sales update lines never change after they are written (corrections are new updates).
create trigger no_change before update or delete on public.sales_update_lines for each row execute function private.no_change();
