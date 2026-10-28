-- TastePass: owner-approved micro-campaigns with a public, claimable pass and merchant-verified redemptions.
-- Public pages read campaigns through RLS (demo tenant is world-readable). Claims and redemptions are written
-- only by server routes through the service role, via the two functions below (atomic, idempotent).

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  hypothesis_id uuid references public.opportunity_hypotheses(id) on delete set null,
  action_item_id uuid references public.action_items(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]{8,16}$'),
  offer_name text not null check (length(offer_name) between 2 and 80),
  menu_item text not null check (length(menu_item) between 1 and 80),
  regular_price numeric(10,2) not null check (regular_price >= 0),
  offer_price numeric(10,2) not null check (offer_price >= 0),
  variable_cost numeric(10,2) not null check (variable_cost >= 0),
  fee_pct numeric(5,4) not null default 0 check (fee_pct >= 0 and fee_pct < 1),
  fixed_spend numeric(10,2) not null default 0 check (fixed_spend >= 0),
  max_redemptions int not null check (max_redemptions between 1 and 10000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  terms text not null default '',
  why text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  economics jsonb not null default '{}'::jsonb,
  decision text not null check (decision in ('go','no_go')),
  status text not null default 'draft' check (status in ('draft','active','ended')),
  mode text not null default 'sandbox' check (mode in ('sandbox','live')),
  page_views int not null default 0,
  created_by text not null default 'system',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists campaigns_restaurant_idx on public.campaigns (restaurant_id, created_at desc);
create index if not exists campaigns_hypothesis_idx on public.campaigns (hypothesis_id);
create trigger campaigns_updated_at before update on public.campaigns for each row execute function public.set_updated_at();

create table if not exists public.pass_claims (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  token text not null check (token ~ '^[A-HJ-NP-Z2-9]{8}$'),
  status text not null default 'claimed' check (status in ('claimed','redeemed','expired')),
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by text,
  verified_sale_amount numeric(10,2) check (verified_sale_amount is null or verified_sale_amount >= 0),
  claim_ip_hash text,
  unique (campaign_id, token)
);
create index if not exists pass_claims_campaign_idx on public.pass_claims (campaign_id, status);

alter table public.campaigns enable row level security;
alter table public.pass_claims enable row level security;

create policy campaigns_select on public.campaigns for select using (private.can_read_restaurant(restaurant_id));
create policy campaigns_insert on public.campaigns for insert with check (private.can_write_restaurant(restaurant_id));
create policy campaigns_update on public.campaigns for update using (private.can_write_restaurant(restaurant_id)) with check (private.can_write_restaurant(restaurant_id));
create policy campaigns_delete on public.campaigns for delete using (private.can_write_restaurant(restaurant_id));
-- Tokens are never world-readable, not even for the demo tenant. No insert/update policies: service role only.
create policy pass_claims_select on public.pass_claims for select using (private.can_write_restaurant(restaurant_id));

-- Atomic claim: lock the campaign row, check window and cap, insert one claim.
create or replace function public.claim_pass(p_campaign uuid, p_token text, p_ttl_minutes int, p_ip_hash text, p_max_per_ip int default 5)
returns jsonb language plpgsql set search_path = public as $$
declare c public.campaigns%rowtype; n int; per_ip int; exp timestamptz;
begin
  select * into c from public.campaigns where id = p_campaign for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if c.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'not_active'); end if;
  if now() < c.starts_at then return jsonb_build_object('ok', false, 'reason', 'not_started'); end if;
  if now() >= c.ends_at then return jsonb_build_object('ok', false, 'reason', 'ended'); end if;
  select count(*) into n from public.pass_claims where campaign_id = p_campaign;
  if n >= c.max_redemptions then return jsonb_build_object('ok', false, 'reason', 'sold_out'); end if;
  if p_ip_hash is not null then
    select count(*) into per_ip from public.pass_claims where campaign_id = p_campaign and claim_ip_hash = p_ip_hash;
    if per_ip >= p_max_per_ip then return jsonb_build_object('ok', false, 'reason', 'limit'); end if;
  end if;
  exp := least(now() + make_interval(mins => greatest(1, p_ttl_minutes)), c.ends_at);
  insert into public.pass_claims (campaign_id, restaurant_id, token, expires_at, claim_ip_hash)
  values (p_campaign, c.restaurant_id, p_token, exp, p_ip_hash);
  return jsonb_build_object('ok', true, 'token', p_token, 'expires_at', exp);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'collision');
end $$;

-- Atomic redeem: one conditional UPDATE. A second call for the same token finds status = 'redeemed' and fails.
create or replace function public.redeem_pass(p_campaign uuid, p_token text, p_actor text, p_sale numeric default null)
returns jsonb language plpgsql set search_path = public as $$
declare r public.pass_claims%rowtype; cs text;
begin
  select status into cs from public.campaigns where id = p_campaign;
  if cs is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if cs = 'ended' then return jsonb_build_object('ok', false, 'reason', 'campaign_ended'); end if;
  update public.pass_claims
     set status = 'redeemed', redeemed_at = now(), redeemed_by = p_actor, verified_sale_amount = p_sale
   where campaign_id = p_campaign and token = upper(p_token) and status = 'claimed' and expires_at > now()
  returning * into r;
  if found then return jsonb_build_object('ok', true, 'claim_id', r.id, 'redeemed_at', r.redeemed_at); end if;
  select * into r from public.pass_claims where campaign_id = p_campaign and token = upper(p_token);
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if r.status = 'redeemed' then return jsonb_build_object('ok', false, 'reason', 'already_redeemed', 'redeemed_at', r.redeemed_at); end if;
  return jsonb_build_object('ok', false, 'reason', 'expired');
end $$;

create or replace function public.bump_campaign_views(p_campaign uuid)
returns void language sql set search_path = public as $$
  update public.campaigns set page_views = page_views + 1 where id = p_campaign and status = 'active';
$$;

revoke all on function public.claim_pass(uuid, text, int, text, int) from public, anon, authenticated;
revoke all on function public.redeem_pass(uuid, text, text, numeric) from public, anon, authenticated;
revoke all on function public.bump_campaign_views(uuid) from public, anon, authenticated;
grant execute on function public.claim_pass(uuid, text, int, text, int) to service_role;
grant execute on function public.redeem_pass(uuid, text, text, numeric) to service_role;
grant execute on function public.bump_campaign_views(uuid) to service_role;
