# External contracts

## Qloo (hackathon tier) — verified from docs.qloo.com on 2026-10-23

Sources: hackathon developer guide (`/reference/qloo-llm-hackathon-developer-guide`), Insights deep dive, parameter reference, `/reference/get-search`, `/reference/get-tags`, `/reference/get-entities`, `/reference/get-audiences`, use-case pages (demographics, taste analysis, heatmaps). Note: `qloo/docs-public/openapi-schema.json` is the generic OpenAPI 3.1 meta-schema, not Qloo's spec.

| Item | Value |
|---|---|
| Base URL | `https://hackathon.api.qloo.com` (hackathon keys fail on staging/production hosts) |
| Auth | header `X-Api-Key: <key>` (no query param, no Bearer) |
| Method | GET only; JSON-body POST fails on hackathon tier |
| Key request | Google form linked from the developer guide; manual issue by email |
| Quotas | rate + monthly quota exist, numbers undocumented; raise via Discord `#api-help` |
| Caching | private server-side caching allowed, no time limit |
| Repo rule | **do not store Qloo response data in a public repository** → fixtures are synthetic |
| Gotchas | invalid params silently ignored (empty 200); no field filtering; 403 = entity type unsupported |

### Endpoints used

1. `GET /v2/insights` — `filter.type` required.
   - Place recommendations: `filter.type=urn:entity:place`, `filter.location.query=<locality>` or `filter.location=POINT(lon lat)` + `filter.location.radius=<m>`, `filter.tags=urn:tag:genre:place:restaurant:<x>`, `signal.interests.entities=<uuid,...>`, `signal.interests.tags=<tag,...>`, `signal.demographics.audiences=<id,...>`, `signal.demographics.age=24_and_younger|25_to_29|30_to_34|35_to_44|45_to_54|55_and_older`, `signal.demographics.gender=male|female`, `feature.explainability=true`, `take<=50`, `page`.
   - Demographic affinity: `filter.type=urn:demographics` + `signal.interests.entities` or `signal.interests.tags` → `results.demographics[] { entity_id, query: { age: {bucket: number}, gender: {male, female} } }`; values are signed deviations from average (positive = stronger than average).
   - Taste analysis (tags): `filter.type=urn:tag`, `filter.tag.types=...`, `filter.parents.types=urn:entity:place`, optional `signal.interests.entities` → `results.tags[] { tag_id, name, types[], subtype, tag_value, query{} }`.
   - Heatmap: `filter.type=urn:heatmap`, `filter.location.query=<city>`, `signal.interests.*` → `results.heatmap[] { location{latitude,longitude,geohash}, query{affinity, affinity_rank, popularity} }`.
   - Response envelope: `{ success, results: { entities|demographics|tags|heatmap, duration } }`. Per-entity fields seen in docs samples: `name, entity_id, type, subtype, properties{...}, popularity, tags[]{id,name,type}, query{...}, disambiguation, external{...}`. Per-entity `query.affinity` for place results is **not shown in docs samples** → normalizer treats it as optional; verify with first live call (task in BUILD_PROGRESS).
2. `GET /search` — `query`, `types=urn:entity:place`, `filter.location=<lat,lon|WKT|uuid>`, `filter.radius` (miles, 0–100, default 10), `filter.tags`, `take<200`, `sort_by=match|distance|popularity`. Returns `{ success, duration, results[] }`. 404 "No results", 429 "Rate limit exceeded" with `{code, reason, message}`.
3. `GET /v2/tags` — `filter.query`, `filter.tag.types`, `filter.parents.types`, `take<=50`, `page`. Returns `results.tags[]`.
4. `GET /entities` — `entity_ids=<uuid,...>` → `{ success, duration, results[] }`.
5. `GET /v2/audiences` — spec marks deprecated; `filter.parents.types` enum: `urn:audience:communities|global_issues|hobbies_and_interests|investing_interests|leisure|life_stage|lifestyle_preferences_beliefs|political_preferences|professional_area|spending_habits`. Used only if live call succeeds; otherwise audiences come from demographics + tags.

### Interpretation rules (product)
- Affinity is 0..1 "how closely two things are connected" (Qloo). It is **not** demand, sales, foot traffic, or market share. UI copy: "taste affinity signal".
- Popularity is a 0..1 percentile, not revenue.
- Demographic values are relative deviations; show sign and bucket, never as "% of customers".

## Supabase
- `@supabase/ssr` 0.12.x cookie-based auth; server client with service role only in `src/lib/db/server.ts`.
- RLS on every table; membership predicate via `organization_memberships`. Views use `security_invoker`.

## POS connectors (interface only, "Planned / not connected")
`PosConnector { id, canAccess(capability) → {ok, reason, requiredScopes}, syncMenu?, syncSalesSummary?, syncOperatingHours?, dataAsOf, lastSyncStatus, dataRights, disconnect }`.
