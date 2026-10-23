-- What the signed-in login may do, from the trusted owner table. The app uses this only to show or
-- hide owner controls; every rule is still enforced by the database itself.
create or replace function public.my_access() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('member', private.is_member(), 'owner', private.is_owner())
$$;
revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;
