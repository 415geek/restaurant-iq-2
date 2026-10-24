-- Row Level Security: membership/ownership predicates on every exposed table.
-- Demo tenant (organizations.is_demo = true) is world-readable; all demo writes go through
-- server routes using the service role (rate-limited). Private tenants require membership.

create or replace function public.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = org and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_read_restaurant(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.restaurants r join public.organizations o on o.id = r.organization_id
    where r.id = rid and (o.is_demo or public.is_org_member(o.id))
  );
$$;

create or replace function public.can_write_restaurant(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.restaurants r
    where r.id = rid and public.is_org_member(r.organization_id)
  );
$$;

-- Create an organization and make the caller its owner (invoker must be authenticated).
create or replace function public.create_organization(org_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.organizations(name) values (org_name) returning id into new_id;
  insert into public.organization_memberships(organization_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;
revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;

-- enable RLS everywhere
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;
alter table public.evidence_sources enable row level security;
alter table public.evidence_records enable row level security;
alter table public.qloo_insights enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.agent_steps enable row level security;
alter table public.opportunity_hypotheses enable row level security;
alter table public.scenarios enable row level security;
alter table public.action_items enable row level security;
alter table public.approvals enable row level security;
alter table public.decision_events enable row level security;
alter table public.outcome_measurements enable row level security;
alter table public.usage_events enable row level security;      -- no policies: service role only
alter table public.demo_rate_limits enable row level security;  -- no policies: service role only
alter table public.provider_cache enable row level security;    -- no policies: service role only

-- organizations
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select
  using (is_demo or public.is_org_member(id));
drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations for update
  using (public.is_org_member(id) and not is_demo) with check (public.is_org_member(id) and not is_demo);

-- memberships: a user sees their own rows and rows of orgs they belong to; inserts only via RPC
drop policy if exists memberships_select on public.organization_memberships;
create policy memberships_select on public.organization_memberships for select
  using (user_id = auth.uid() or public.is_org_member(organization_id));

-- restaurants
drop policy if exists restaurants_select on public.restaurants;
create policy restaurants_select on public.restaurants for select
  using (exists (select 1 from public.organizations o where o.id = organization_id and (o.is_demo or public.is_org_member(o.id))));
drop policy if exists restaurants_insert on public.restaurants;
create policy restaurants_insert on public.restaurants for insert
  with check (public.is_org_member(organization_id));
drop policy if exists restaurants_update on public.restaurants;
create policy restaurants_update on public.restaurants for update
  using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
drop policy if exists restaurants_delete on public.restaurants;
create policy restaurants_delete on public.restaurants for delete
  using (public.is_org_member(organization_id));

-- generic restaurant-scoped tables
do $$
declare t text;
begin
  foreach t in array array['menu_items','evidence_sources','evidence_records','qloo_insights','analysis_runs',
                           'agent_steps','opportunity_hypotheses','scenarios','action_items','approvals','outcome_measurements']
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select using (public.can_read_restaurant(restaurant_id))', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (public.can_write_restaurant(restaurant_id))', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('create policy %I_update on public.%I for update using (public.can_write_restaurant(restaurant_id)) with check (public.can_write_restaurant(restaurant_id))', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_delete on public.%I for delete using (public.can_write_restaurant(restaurant_id))', t, t);
  end loop;
end $$;

-- decision_events: readable by members/demo, insertable by members, never updated/deleted (trigger enforces)
drop policy if exists decision_events_select on public.decision_events;
create policy decision_events_select on public.decision_events for select using (public.can_read_restaurant(restaurant_id));
drop policy if exists decision_events_insert on public.decision_events;
create policy decision_events_insert on public.decision_events for insert with check (public.can_write_restaurant(restaurant_id));
