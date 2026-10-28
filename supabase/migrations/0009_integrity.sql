-- 0009: integrity fixes from review.
-- 1) Campaign creation is one transaction (task + approval + campaign + idea status + event) and idempotent by request_id.
-- 2) Each campaign stores the decision basis it was created from (anchor / moment / idea evidence, query time, rejected alternatives).
-- 3) Sales rows carry their grain (order, line, day), whether a real time of day was present, and a dedupe key so overlapping
--    reports (yesterday's daily + this week's cumulative) never count the same order twice. Imports are one transaction.
-- Rollback: drop function public.import_sales(jsonb, jsonb); drop function public.create_campaign(jsonb);
--           alter table public.sales_records drop column dedupe_key, drop column has_time, drop column grain;
--           alter table public.campaigns drop column request_id, drop column decision_basis;

alter table public.campaigns add column if not exists decision_basis jsonb;
alter table public.campaigns add column if not exists request_id uuid;
create unique index if not exists campaigns_request_id_idx on public.campaigns(request_id) where request_id is not null;

alter table public.sales_records add column if not exists grain text not null default 'order' check (grain in ('order','line','day'));
alter table public.sales_records add column if not exists has_time boolean not null default true;
alter table public.sales_records add column if not exists dedupe_key text;
create unique index if not exists sales_records_dedupe_idx on public.sales_records(restaurant_id, dedupe_key) where dedupe_key is not null;

create or replace function public.create_campaign(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_action uuid; v_id uuid; v_live boolean := coalesce((p->>'go_live')::boolean, false); ex record;
begin
  select id, slug, status into ex from public.campaigns where request_id = (p->>'request_id')::uuid;
  if found then return jsonb_build_object('ok', true, 'id', ex.id, 'slug', ex.slug, 'status', ex.status, 'replayed', true); end if;
  if v_live then
    insert into public.action_items (hypothesis_id, restaurant_id, title, title_lt, description, description_lt, status, requires_approval, external_side_effect, owner)
    values ((p->>'hypothesis_id')::uuid, (p->>'restaurant_id')::uuid, p->>'task_title', p->'task_title_lt', p->>'task_desc', p->'task_desc_lt', 'ready', true, true, 'Owner')
    returning id into v_action;
    insert into public.approvals (action_item_id, restaurant_id, approved_by, actor_label, decision, note)
    values (v_action, (p->>'restaurant_id')::uuid, nullif(p->>'approved_by', '')::uuid, p->>'actor', 'approved', 'TastePass approved');
  end if;
  insert into public.campaigns (restaurant_id, hypothesis_id, action_item_id, slug, offer_name, menu_item, regular_price, offer_price, variable_cost,
    fee_pct, fixed_spend, max_redemptions, starts_at, ends_at, terms, moment, why, evidence, economics, decision, status, mode, created_by, approved_at, decision_basis, request_id)
  values ((p->>'restaurant_id')::uuid, (p->>'hypothesis_id')::uuid, v_action, p->>'slug', p->>'offer_name', p->>'menu_item', (p->>'regular_price')::numeric,
    (p->>'offer_price')::numeric, (p->>'variable_cost')::numeric, (p->>'fee_pct')::numeric, (p->>'fixed_spend')::numeric, (p->>'max_redemptions')::int,
    (p->>'starts_at')::timestamptz, (p->>'ends_at')::timestamptz, coalesce(p->>'terms', ''), nullif(p->'moment', 'null'::jsonb), p->>'why', coalesce(p->'evidence', '[]'::jsonb),
    p->'economics', p->>'decision', case when v_live then 'active' else 'draft' end, p->>'mode', p->>'actor', case when v_live then now() else null end,
    p->'decision_basis', (p->>'request_id')::uuid)
  returning id into v_id;
  update public.opportunity_hypotheses set status = 'pursued' where id = (p->>'hypothesis_id')::uuid and status = 'proposed';
  insert into public.decision_events (restaurant_id, kind, subject_id, summary, payload, actor)
  values ((p->>'restaurant_id')::uuid, case when v_live then 'campaign_approved' else 'campaign_drafted' end, v_id, p->>'event_summary',
    coalesce(p->'event_payload', '{}'::jsonb) || jsonb_build_object('campaignId', v_id), p->>'actor');
  return jsonb_build_object('ok', true, 'id', v_id, 'slug', p->>'slug', 'status', case when v_live then 'active' else 'draft' end, 'replayed', false);
end $$;
revoke all on function public.create_campaign(jsonb) from public, anon, authenticated;
grant execute on function public.create_campaign(jsonb) to service_role;

-- Upload row + all its sales rows in one transaction. Rows whose dedupe key already exists are skipped and counted.
create or replace function public.import_sales(p_upload jsonb, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_rid uuid := (p_upload->>'restaurant_id')::uuid; v_in int; v_total int := jsonb_array_length(p_rows);
begin
  if p_upload ? 'id' then
    update public.data_uploads set status = 'imported', staged_rows = null where id = (p_upload->>'id')::uuid and restaurant_id = v_rid and status = 'staged' returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'reason', 'not_staged'); end if;
  else
    insert into public.data_uploads (restaurant_id, file_name, file_type, size_bytes, sha256, platform, status, row_count, mapping, mapping_method, header_fingerprint, created_by)
    values (v_rid, p_upload->>'file_name', p_upload->>'file_type', (p_upload->>'size_bytes')::int, p_upload->>'sha256', p_upload->>'platform', 'imported',
      (p_upload->>'row_count')::int, coalesce(p_upload->'mapping', '[]'::jsonb), p_upload->>'mapping_method', p_upload->>'header_fingerprint', p_upload->>'created_by')
    returning id into v_id;
  end if;
  insert into public.sales_records (restaurant_id, upload_id, platform, channel, order_id, ordered_at, item_name, quantity, gross_sales, discounts, net_sales, tax, tip,
    platform_fees, payout, refunds, status, row_ref, grain, has_time, dedupe_key)
  select v_rid, v_id, r.platform, r.channel, r.order_id, r.ordered_at, r.item_name, r.quantity, r.gross_sales, r.discounts, r.net_sales, r.tax, r.tip,
    r.platform_fees, r.payout, r.refunds, r.status, r.row_ref, r.grain, r.has_time, r.dedupe_key
  from jsonb_to_recordset(p_rows) as r(platform text, channel text, order_id text, ordered_at timestamptz, item_name text, quantity numeric, gross_sales numeric,
    discounts numeric, net_sales numeric, tax numeric, tip numeric, platform_fees numeric, payout numeric, refunds numeric, status text, row_ref int, grain text, has_time boolean, dedupe_key text)
  on conflict (restaurant_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_in = row_count;
  update public.data_uploads set imported_count = v_in, rejected_count = coalesce((p_upload->>'rejected_count')::int, 0) where id = v_id;
  return jsonb_build_object('ok', true, 'upload_id', v_id, 'inserted', v_in, 'overlapping', v_total - v_in);
end $$;
revoke all on function public.import_sales(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.import_sales(jsonb, jsonb) to service_role;
