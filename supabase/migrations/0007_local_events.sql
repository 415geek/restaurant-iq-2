-- 0007: daily snapshot of public local events per city, refreshed by a cron job (rolling 45-day window).
-- Public data only (no personal fields are stored). Reads are open; writes go through the service role.
-- Rollback: drop table public.local_event_refreshes; drop table public.local_events;
create table if not exists public.local_events (
  id uuid primary key default gen_random_uuid(),
  area_key text not null check (length(area_key) between 2 and 80),
  source text not null check (source in ('sf_street','sf_our415','nyc_permits','chicago_parks','web_google_events')),
  external_id text not null check (length(external_id) between 1 and 200),
  name text not null check (length(name) between 1 and 120),
  date date not null,
  end_date date,
  start_time text check (start_time is null or start_time ~ '^\d{2}:\d{2}$'),
  end_time text check (end_time is null or end_time ~ '^\d{2}:\d{2}$'),
  where_text text check (where_text is null or length(where_text) <= 160),
  org text check (org is null or length(org) <= 80),
  lat double precision, lng double precision,
  theme text,
  link text check (link is null or link ~ '^https://'),
  fetched_at timestamptz not null default now(),
  unique (source, external_id, date)
);
create index if not exists local_events_area_date_idx on public.local_events(area_key, date);
alter table public.local_events enable row level security;
create policy local_events_read on public.local_events for select to anon, authenticated using (true);

create table if not exists public.local_event_refreshes (
  id bigserial primary key,
  area_key text not null,
  source text not null,
  state text not null check (state in ('ok','error','skipped')),
  error_class text,
  count int not null default 0,
  ran_at timestamptz not null default now()
);
create index if not exists local_event_refreshes_area_idx on public.local_event_refreshes(area_key, source, ran_at desc);
alter table public.local_event_refreshes enable row level security;
create policy local_event_refreshes_read on public.local_event_refreshes for select to anon, authenticated using (true);

revoke insert, update, delete on public.local_events, public.local_event_refreshes from anon, authenticated;
