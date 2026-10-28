-- 0008: operational data uploads (POS / delivery exports), unified sales records, and the Business Brain.
-- Raw files are never stored: only a hash, the confirmed column mapping and the normalized rows.
-- Columns flagged as personal data are dropped before anything is written.
-- Rollback: drop table public.brain_memories; drop table public.sales_records; drop table public.data_uploads;

create table if not exists public.data_uploads (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  file_name text not null check (length(file_name) between 1 and 200),
  file_type text not null check (length(file_type) <= 40),
  size_bytes int not null check (size_bytes >= 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  platform text not null default 'other',
  status text not null check (status in ('staged','imported','failed')),
  row_count int not null default 0,
  imported_count int not null default 0,
  rejected_count int not null default 0,
  mapping jsonb not null default '[]'::jsonb,
  mapping_method text not null check (mapping_method in ('memory','rules','ai','owner','ai_document')),
  header_fingerprint text,
  staged_rows jsonb,           -- only for AI-extracted documents awaiting confirmation; cleared on import
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists data_uploads_restaurant_idx on public.data_uploads(restaurant_id, created_at desc);
create unique index if not exists data_uploads_dedupe_idx on public.data_uploads(restaurant_id, sha256) where status = 'imported';

create table if not exists public.sales_records (
  id bigserial primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  upload_id uuid not null references public.data_uploads(id) on delete cascade,
  platform text not null,
  channel text not null check (channel in ('dine_in','takeout','delivery','catering','unknown')),
  order_id text,
  ordered_at timestamptz not null,
  item_name text,
  quantity numeric(10,2),
  gross_sales numeric(12,2), discounts numeric(12,2), net_sales numeric(12,2), tax numeric(12,2), tip numeric(12,2),
  platform_fees numeric(12,2), payout numeric(12,2), refunds numeric(12,2),
  status text not null default 'completed' check (status in ('completed','refunded','cancelled')),
  row_ref int
);
create index if not exists sales_records_restaurant_time_idx on public.sales_records(restaurant_id, ordered_at);

create table if not exists public.brain_memories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  kind text not null check (kind in ('mapping','dataset','insight','action')),
  key text not null check (length(key) between 1 and 200),
  title text not null check (length(title) between 1 and 200),
  content jsonb not null default '{}'::jsonb,
  source text not null,
  uses int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, kind, key)
);
create index if not exists brain_memories_restaurant_idx on public.brain_memories(restaurant_id, updated_at desc);

alter table public.data_uploads enable row level security;
alter table public.sales_records enable row level security;
alter table public.brain_memories enable row level security;
-- Read: members (or anyone for the synthetic demo tenant). Writes: server routes with the service role only.
create policy data_uploads_read on public.data_uploads for select using (private.can_read_restaurant(restaurant_id));
create policy sales_records_read on public.sales_records for select using (private.can_read_restaurant(restaurant_id));
create policy brain_memories_read on public.brain_memories for select using (private.can_read_restaurant(restaurant_id));
revoke insert, update, delete on public.data_uploads, public.sales_records, public.brain_memories from anon, authenticated;
