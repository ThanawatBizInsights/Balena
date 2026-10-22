-- A login is linked to its member row only once its email is confirmed, so nobody can claim a
-- partner's email by signing up first. Runs when the login is created (already confirmed, e.g.
-- by an admin) and when the confirmation link is opened.
create or replace function private.link_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null then
    update public.members set user_id = new.id where email = lower(new.email) and user_id is null;
  end if;
  return new;
end $$;

create trigger link_member_confirmed after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.link_member();

-- Members added after their login already exists (and is confirmed) are linked straight away.
create or replace function private.link_existing_login() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is null then
    select id into new.user_id from auth.users
    where lower(email) = new.email and email_confirmed_at is not null;
  end if;
  return new;
end $$;
create trigger link_existing_login before insert or update of email on public.members
  for each row execute function private.link_existing_login();
revoke all on function private.link_existing_login() from public, anon, authenticated;
revoke all on function private.link_member() from public, anon, authenticated;
