-- Hardening from Supabase security advisors (2026-10-24):
-- 1) RLS helper functions move to a non-exposed schema so they are not callable via /rest/v1/rpc.
-- 2) Trigger functions get a fixed search_path.
-- 3) create_organization is callable by authenticated users only.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

alter function public.is_org_member(uuid) set schema private;
alter function public.can_read_restaurant(uuid) set schema private;
alter function public.can_write_restaurant(uuid) set schema private;
-- policies reference the functions by OID, so they keep working after the move.
revoke all on function private.is_org_member(uuid) from public;
revoke all on function private.can_read_restaurant(uuid) from public;
revoke all on function private.can_write_restaurant(uuid) from public;
grant execute on function private.is_org_member(uuid) to anon, authenticated, service_role;
grant execute on function private.can_read_restaurant(uuid) to anon, authenticated, service_role;
grant execute on function private.can_write_restaurant(uuid) to anon, authenticated, service_role;

-- helpers call each other: make sure bodies resolve through the new schema
create or replace function private.can_read_restaurant(rid uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.restaurants r join public.organizations o on o.id = r.organization_id
    where r.id = rid and (o.is_demo or private.is_org_member(o.id))
  );
$$;
create or replace function private.can_write_restaurant(rid uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.restaurants r
    where r.id = rid and private.is_org_member(r.organization_id)
  );
$$;

alter function public.set_updated_at() set search_path = public;
alter function public.forbid_mutation() set search_path = public;

revoke execute on function public.create_organization(text) from anon;
