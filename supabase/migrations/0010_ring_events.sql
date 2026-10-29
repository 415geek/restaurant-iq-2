-- 0010: Ring entrance camera, events only.
-- We store when a person-motion event happened and nothing else: no video, no images, no audio, no device names.
-- ring_connections holds the OAuth tokens (AES-GCM encrypted in app code) and is readable by the service role only.
-- Rollback: drop table public.ring_events; drop table public.ring_connections;

create table if not exists public.ring_connections (
  id uuid primary key default gen_random_uuid(),
  account_id text not null unique check (length(account_id) between 1 and 200),
  restaurant_id uuid references public.restaurants(id) on delete cascade,  -- null until the owner confirms the link
  status text not null check (status in ('pending','linked','revoked')),
  token_enc text not null,          -- encrypted {access_token, refresh_token}
  token_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  linked_at timestamptz,
  revoked_at timestamptz
);
create index if not exists ring_connections_restaurant_idx on public.ring_connections(restaurant_id) where status = 'linked';

create table if not exists public.ring_events (
  id bigserial primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  request_id text not null unique check (length(request_id) between 1 and 200),  -- Ring meta.request_id, for idempotent retries
  kind text not null check (kind in ('person_motion')),
  occurred_at timestamptz not null,
  device_ref text not null check (device_ref ~ '^[0-9a-f]{12}$'),  -- truncated hash, never the raw device id
  received_at timestamptz not null default now()
);
create index if not exists ring_events_restaurant_time_idx on public.ring_events(restaurant_id, occurred_at);

alter table public.ring_connections enable row level security;
alter table public.ring_events enable row level security;
-- Connections: no policies at all (service role only). Events: readable like other restaurant data; writes via the webhook only.
create policy ring_events_read on public.ring_events for select using (private.can_read_restaurant(restaurant_id));
revoke all on public.ring_connections from anon, authenticated;
revoke insert, update, delete on public.ring_events from anon, authenticated;
