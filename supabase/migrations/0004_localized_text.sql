-- Localized generated text: keyed templates stored next to the English fallback columns.
alter table public.action_items add column if not exists title_lt jsonb;
alter table public.action_items add column if not exists description_lt jsonb;
