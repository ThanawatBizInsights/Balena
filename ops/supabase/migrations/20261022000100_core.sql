-- Balena operations: core (members, reference data, settings, audit).
-- Every table is readable only by signed-in, active members. Writes to business records go
-- through the posting functions in later migrations, never straight from the browser.

create extension if not exists pgcrypto;
create schema if not exists private;

-- Errors the app can translate: message 'balena:<key>', details as JSON.
create or replace function private.fail(p_key text, p_detail jsonb default '{}'::jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = 'balena:' || p_key, detail = p_detail::text;
end $$;

-- ---------- members and roles ----------

create table public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text not null unique check (email = lower(email)),
  display_name text not null,
  role text not null check (role in ('owner', 'partner', 'staff')),
  home_location text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.members is 'Who may use the app. A login is linked by email when the person first signs in.';

-- Link a new login to its member row (by email).
create or replace function private.link_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.members set user_id = new.id where email = lower(new.email) and user_id is null;
  return new;
end $$;
create trigger link_member after insert on auth.users for each row execute function private.link_member();

create or replace function private.member_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.members where user_id = auth.uid() and active
$$;
create or replace function private.member_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.members where user_id = auth.uid() and active
$$;
create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where user_id = auth.uid() and active)
$$;
create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.member_role() = 'owner', false)
$$;
-- Partners and the owner see money and cost figures; staff do not.
create or replace function private.sees_money() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.member_role() in ('owner', 'partner'), false)
$$;

-- ---------- reference data ----------

create table public.locations (
  code text primary key,
  name_th text not null,
  name_en text not null,
  kind text not null check (kind in ('own', 'consignment', 'transit')),
  active boolean not null default true
);

create table public.accounts (
  code text primary key,
  name text not null,
  holder text,
  kind text not null check (kind in ('bank', 'cash')),
  active boolean not null default true
);
comment on column public.accounts.name is 'Short name only. Never store account numbers here.';

create table public.channels (
  code text primary key,
  name text not null,
  kind text not null check (kind in ('shop', 'online', 'consignment', 'delivery')),
  fee_percent numeric(5,2) check (fee_percent between 0 and 100),
  fee_confirmed boolean not null default false,
  settles_days integer,
  active boolean not null default true
);
comment on column public.channels.fee_percent is 'Null until known. A guessed fee must stay fee_confirmed = false.';

create table public.settings (
  key text primary key,
  value numeric,
  note text,
  updated_by uuid references public.members (id),
  updated_at timestamptz not null default now()
);
comment on table public.settings is 'Agreed limits. Null = not agreed yet, which means approval is always required.';

-- ---------- audit ----------

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  member_id uuid references public.members (id),
  action text not null,
  table_name text not null,
  record_id text not null,
  old_values jsonb,
  new_values jsonb,
  reason text
);
create index audit_log_record on public.audit_log (table_name, record_id);
create index audit_log_at on public.audit_log (at desc);

create or replace function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (member_id, action, table_name, record_id, old_values, new_values)
  values (
    private.member_id(),
    lower(tg_op),
    tg_table_name,
    coalesce(rec ->> 'id', rec ->> 'code', rec ->> 'key', '?'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

-- Explicit audit entries from posting functions (approve, reverse, dispute...).
create or replace function private.log(p_action text, p_table text, p_id text, p_reason text default null, p_new jsonb default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (member_id, action, table_name, record_id, new_values, reason)
  values (private.member_id(), p_action, p_table, p_id, p_new, p_reason)
$$;

create trigger audit after insert or update or delete on public.members for each row execute function private.audit();
create trigger audit after insert or update or delete on public.locations for each row execute function private.audit();
create trigger audit after insert or update or delete on public.accounts for each row execute function private.audit();
create trigger audit after insert or update or delete on public.channels for each row execute function private.audit();
create trigger audit after insert or update or delete on public.settings for each row execute function private.audit();
