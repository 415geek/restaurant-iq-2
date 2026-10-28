-- 0006: a TastePass can be timed to a local moment (holiday, street event, community event, owner-added event).
-- Shape: {kind, name, date (YYYY-MM-DD), source, theme?}. Rollback: alter table public.campaigns drop column moment;
alter table public.campaigns add column if not exists moment jsonb
  check (moment is null or (jsonb_typeof(moment) = 'object' and moment ? 'name' and moment ? 'date' and moment ? 'kind'));
comment on column public.campaigns.moment is 'Local moment the pass is timed to; claims stay valid until the pass ends.';
