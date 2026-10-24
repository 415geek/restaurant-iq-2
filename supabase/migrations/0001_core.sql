-- Restaurant IQ 2.0 core schema (reversible: see bottom for down notes)
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists organization_memberships_user_idx on public.organization_memberships(user_id);

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  neighborhood text,
  city text not null default 'San Francisco',
  region text not null default 'CA',
  country_code text not null default 'US',
  cuisine text not null,
  service_formats text[] not null default '{}',
  hours_summary text,
  price_level smallint check (price_level between 1 and 4),
  menu_url text,
  cost_assumptions jsonb not null default '{}'::jsonb,
  objectives jsonb not null default '{}'::jsonb,
  pos_preference text,
  data_mode text not null default 'sample' check (data_mode in ('sample','live')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restaurants_org_idx on public.restaurants(organization_id);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  category text not null default 'main',
  price numeric(10,2) check (price >= 0),
  food_cost numeric(10,2) check (food_cost >= 0),
  source text not null default 'manual',
  is_signature boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists menu_items_restaurant_idx on public.menu_items(restaurant_id);

create table if not exists public.evidence_sources (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  provider text not null,
  endpoint text not null,
  request_params jsonb not null default '{}'::jsonb, -- redacted, never contains keys
  retrieved_at timestamptz not null default now(),
  freshness_ttl_seconds integer not null default 86400,
  mode text not null check (mode in ('sample','live')),
  citation_url text,
  created_at timestamptz not null default now()
);
create index if not exists evidence_sources_restaurant_idx on public.evidence_sources(restaurant_id);

create table if not exists public.evidence_records (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source_id uuid not null references public.evidence_sources(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  interpretation text,
  confidence_label text not null default 'requires_validation'
    check (confidence_label in ('high','medium','low','requires_validation')),
  created_at timestamptz not null default now()
);
create index if not exists evidence_records_restaurant_idx on public.evidence_records(restaurant_id);

create table if not exists public.qloo_insights (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source_id uuid not null references public.evidence_sources(id) on delete cascade,
  kind text not null check (kind in ('entities','tags','demographics','heatmap','search')),
  normalized jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists qloo_insights_restaurant_idx on public.qloo_insights(restaurant_id);

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  trace_id text not null unique,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','canceled')),
  mode text not null check (mode in ('sample','live')),
  started_at timestamptz,
  finished_at timestamptz,
  error_class text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analysis_runs_restaurant_idx on public.analysis_runs(restaurant_id, created_at desc);

create table if not exists public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.analysis_runs(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  agent text not null,
  seq smallint not null,
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed','skipped')),
  started_at timestamptz,
  finished_at timestamptz,
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  tool_calls integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists agent_steps_run_idx on public.agent_steps(run_id, seq);

create table if not exists public.opportunity_hypotheses (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.analysis_runs(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  rank smallint not null,
  slug text not null,
  title text not null,
  segment text not null,
  baseline_variant jsonb not null default '{}'::jsonb,
  qloo_variant jsonb not null default '{}'::jsonb,
  evidence_ids uuid[] not null default '{}',
  score_breakdown jsonb not null default '{}'::jsonb,
  evidence_label text not null check (evidence_label in ('high','medium','low','requires_validation','not_recommended')),
  disqualifiers text[] not null default '{}',
  status text not null default 'proposed' check (status in ('proposed','pursued','rejected')),
  playbook jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists opportunity_hypotheses_restaurant_idx on public.opportunity_hypotheses(restaurant_id, run_id, rank);

create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  hypothesis_id uuid not null references public.opportunity_hypotheses(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  label text not null default 'Scenario',
  assumptions jsonb not null,
  results jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists scenarios_hypothesis_idx on public.scenarios(hypothesis_id);

create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  hypothesis_id uuid references public.opportunity_hypotheses(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft','needs_approval','ready','in_progress','completed','canceled')),
  owner text,
  due_date date,
  evidence_ids uuid[] not null default '{}',
  requires_approval boolean not null default false,
  external_side_effect boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists action_items_restaurant_idx on public.action_items(restaurant_id, status);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  action_item_id uuid not null references public.action_items(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  approved_by uuid references auth.users(id) on delete set null,
  actor_label text not null default 'owner',
  decision text not null check (decision in ('approved','rejected')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.decision_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  kind text not null,
  subject_id uuid,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  actor text not null default 'system',
  created_at timestamptz not null default now()
);
create index if not exists decision_events_restaurant_idx on public.decision_events(restaurant_id, created_at desc);

create table if not exists public.outcome_measurements (
  id uuid primary key default gen_random_uuid(),
  hypothesis_id uuid not null references public.opportunity_hypotheses(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  period text not null,
  baseline jsonb not null default '{}'::jsonb,
  actual jsonb not null default '{}'::jsonb,
  attribution_note text,
  recommendation text check (recommendation in ('repeat','revise','stop')),
  created_at timestamptz not null default now()
);

-- operational tables: service-role only (RLS enabled, no policies)
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  endpoint text not null,
  cache_hit boolean not null default false,
  latency_ms integer,
  cost_estimate numeric(10,4),
  error_class text,
  trace_id text,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_provider_day_idx on public.usage_events(provider, created_at desc);

create table if not exists public.demo_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

create table if not exists public.provider_cache (
  cache_key text primary key,
  provider text not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists provider_cache_expires_idx on public.provider_cache(expires_at);

-- updated_at trigger
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists restaurants_updated_at on public.restaurants;
create trigger restaurants_updated_at before update on public.restaurants for each row execute function public.set_updated_at();
drop trigger if exists hypotheses_updated_at on public.opportunity_hypotheses;
create trigger hypotheses_updated_at before update on public.opportunity_hypotheses for each row execute function public.set_updated_at();
drop trigger if exists action_items_updated_at on public.action_items;
create trigger action_items_updated_at before update on public.action_items for each row execute function public.set_updated_at();

-- decision_events are immutable
create or replace function public.forbid_mutation() returns trigger language plpgsql as $$
begin raise exception 'decision_events are immutable'; end $$;
drop trigger if exists decision_events_immutable on public.decision_events;
create trigger decision_events_immutable before update or delete on public.decision_events for each row execute function public.forbid_mutation();

-- DOWN (manual): drop tables in reverse dependency order; no data outside these tables is touched.
