-- 0011: TasteFront ("one storefront per neighborhood"). Brands, stores, menus, versioned storefronts, moves, runs, holdouts.
-- Tenant = organization (reuses organizations.is_demo + public.is_org_member). Writes go through server routes (service role).
-- Rollback: drop table public.front_holdouts, public.front_moves, public.front_versions, public.front_runs,
--           public.front_menu_items, public.front_menus, public.front_stores, public.front_guardrails, public.front_brands;

create table if not exists public.front_brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  size_class text not null check (size_class in ('single','small_chain','franchise')),
  created_at timestamptz not null default now()
);
create table if not exists public.front_guardrails (
  brand_id uuid primary key references public.front_brands(id) on delete cascade,
  renamable_item_ids uuid[] not null default '{}',
  price_band_pct numeric(5,2) not null default 15 check (price_band_pct between 0 and 100),
  banned_terms text[] not null default '{}',
  tone text not null default 'plain' check (tone in ('warm','plain','playful','premium')),
  updated_at timestamptz not null default now()
);
create table if not exists public.front_stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.front_brands(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  name text not null check (length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  address text not null default '',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  neighborhood text not null default '',
  city text not null default '',
  cuisine text not null default '',
  language text not null default 'en' check (language in ('en','zh','es')),
  qloo_entity_id text,
  created_at timestamptz not null default now()
);
create index if not exists front_stores_brand_idx on public.front_stores(brand_id);
create index if not exists front_stores_org_idx on public.front_stores(organization_id);

create table if not exists public.front_menus (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.front_stores(id) on delete cascade,
  source text not null check (source in ('photo','url','csv','manual','seed')),
  parsed_at timestamptz not null default now()
);
create table if not exists public.front_menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.front_menus(id) on delete cascade,
  store_id uuid not null references public.front_stores(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  name_en text,
  description text,
  price_cents int not null check (price_cents >= 0),
  cost_cents int check (cost_cents >= 0),
  category text not null default 'main',
  sort_index int not null default 0,
  qloo_tag_ids text[] not null default '{}',
  tag_candidates jsonb not null default '[]'::jsonb,
  ambiguous boolean not null default false
);
create index if not exists front_menu_items_store_idx on public.front_menu_items(store_id, sort_index);

create table if not exists public.front_runs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.front_stores(id) on delete cascade,
  mode text not null check (mode in ('live','sample')),
  variant text not null check (variant in ('qloo','baseline')),
  status text not null check (status in ('running','completed','failed')),
  events jsonb not null default '[]'::jsonb,
  calls jsonb not null default '[]'::jsonb,       -- QlooCallRecord[] : provenance + names/scores exactly as returned (never raw payloads)
  moves jsonb not null default '[]'::jsonb,
  caveats jsonb not null default '[]'::jsonb,
  version_id uuid,
  error text,
  actor text not null default 'system',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists front_runs_store_idx on public.front_runs(store_id, created_at desc);

create table if not exists public.front_versions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.front_stores(id) on delete cascade,
  version_no int not null,
  generated_by text not null check (generated_by in ('qloo','baseline')),
  run_id uuid references public.front_runs(id) on delete set null,
  items_json jsonb not null,
  parent_version_id uuid references public.front_versions(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published','rolled_back')),
  published_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  unique (store_id, version_no)
);
create index if not exists front_versions_store_idx on public.front_versions(store_id, version_no desc);

create table if not exists public.front_moves (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.front_versions(id) on delete cascade,
  store_id uuid not null references public.front_stores(id) on delete cascade,
  kind text not null check (kind in ('reorder','rename','feature','promote','pass')),
  item_id uuid not null references public.front_menu_items(id) on delete cascade,
  before_json jsonb not null default '{}'::jsonb,
  after_json jsonb not null default '{}'::jsonb,
  evidence_json jsonb not null default '[]'::jsonb,
  verified boolean not null default false,
  risk text not null check (risk in ('low','mid')),
  status text not null default 'proposed' check (status in ('proposed','approved','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists front_moves_version_idx on public.front_moves(version_id);

create table if not exists public.front_holdouts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.front_stores(id) on delete cascade,
  brand_id uuid references public.front_brands(id) on delete cascade,
  kind text not null check (kind in ('week_alternate','store_split')),
  change_window jsonb not null,
  control_window jsonb,
  assignment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (store_id is not null or brand_id is not null)
);

-- RLS: read for members or anyone on the demo tenant; no client writes (service role only through server routes).
create or replace function private.can_read_org(oid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organizations o where o.id = oid and (o.is_demo or private.is_org_member(o.id)));
$$;
revoke all on function private.can_read_org(uuid) from public, anon, authenticated;
grant execute on function private.can_read_org(uuid) to anon, authenticated;

alter table public.front_brands enable row level security;
alter table public.front_guardrails enable row level security;
alter table public.front_stores enable row level security;
alter table public.front_menus enable row level security;
alter table public.front_menu_items enable row level security;
alter table public.front_runs enable row level security;
alter table public.front_versions enable row level security;
alter table public.front_moves enable row level security;
alter table public.front_holdouts enable row level security;

create policy front_brands_read on public.front_brands for select using (private.can_read_org(organization_id));
create policy front_guardrails_read on public.front_guardrails for select using (exists (select 1 from public.front_brands b where b.id = brand_id and private.can_read_org(b.organization_id)));
create policy front_stores_read on public.front_stores for select using (private.can_read_org(organization_id));
create policy front_menus_read on public.front_menus for select using (exists (select 1 from public.front_stores s where s.id = store_id and private.can_read_org(s.organization_id)));
create policy front_menu_items_read on public.front_menu_items for select using (exists (select 1 from public.front_stores s where s.id = store_id and private.can_read_org(s.organization_id)));
create policy front_runs_read on public.front_runs for select using (exists (select 1 from public.front_stores s where s.id = store_id and private.can_read_org(s.organization_id)));
create policy front_versions_read on public.front_versions for select using (exists (select 1 from public.front_stores s where s.id = store_id and private.can_read_org(s.organization_id)));
create policy front_moves_read on public.front_moves for select using (exists (select 1 from public.front_stores s where s.id = store_id and private.can_read_org(s.organization_id)));
create policy front_holdouts_read on public.front_holdouts for select using (
  (store_id is not null and exists (select 1 from public.front_stores s where s.id = store_id and private.can_read_org(s.organization_id)))
  or (brand_id is not null and exists (select 1 from public.front_brands b where b.id = brand_id and private.can_read_org(b.organization_id))));
revoke insert, update, delete on public.front_brands, public.front_guardrails, public.front_stores, public.front_menus, public.front_menu_items,
  public.front_runs, public.front_versions, public.front_moves, public.front_holdouts from anon, authenticated;
