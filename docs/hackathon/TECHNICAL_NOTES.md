# Technical notes

## Qloo usage (real endpoints, documented parameters only)
| Step | Endpoint | Key params | Normalized to |
|---|---|---|---|
| Cuisine → tags | `GET /v2/tags` (one call per cuisine term) | `filter.query`, `filter.parents.types=urn:entity:place`; restaurant genre tags ranked first | `TagSignal[]` |
| Place attributes | `GET /v2/insights` ×4 | `filter.type=urn:tag`, `filter.tag.types` ∈ {genre:place, ambience:qloo, customer_identity:qloo, specialty_dish:place}, `signal.interests.tags`, `signal.location.query` | `TagSignal[]` |
| Anchor search | `GET /search` | `query`, `types=artist,movie,tv_show,brand,podcast` | `EntityReference[]` |
| Anchor → places | `GET /v2/insights` | `filter.type=urn:entity:place`, `filter.location.query`, `filter.tags=urn:tag:genre:place:restaurant`, `signal.interests.entities`, `feature.explainability=true` | `CulturalSignal[]` |
| Anchor → audience | `GET /v2/insights` | `filter.type=urn:demographics`, `signal.interests.entities` | `AudienceAffinity[]` |
| Nearby places | `GET /v2/insights` | `filter.type=urn:entity:place`, `filter.location.query`, `signal.interests.tags`, `feature.explainability=true`, `take` | `CulturalSignal[]` incl. `explainability` |
| Cross-domain | `GET /v2/insights` ×4 | `filter.type=urn:entity:{brand,podcast,artist,tv_show}`, `signal.interests.tags`, `signal.location.query` | `CulturalSignal[]` (403 types skipped, recorded) |
| Demographics | `GET /v2/insights` | `filter.type=urn:demographics`, `signal.interests.tags` | `AudienceAffinity[]` (signed deltas) |

Base URL `https://hackathon.api.qloo.com`, header `X-Api-Key`, GET only (hackathon guide). Client: 15 s timeout, 2 retries with backoff on 429/5xx, error classes (`no_key, timeout, rate_limited, forbidden, not_found, bad_request, server, malformed, network, quota_exceeded`). Usage guard: 24 h cache keyed by sorted params (`provider_cache`), daily cap (`QLOO_DAILY_CALL_CAP`), concurrency cap, sanitized `usage_events`.

## Agent model
`src/lib/agents/orchestrator.ts`: six steps, each an `agent_steps` row with status, budget (max 8 tool calls), 45 s timeout, trace id. Hard Qloo failures (`forbidden`, `quota_exceeded`, `no_key`) abort the run as `failed`; soft failures are recorded and the run continues with partial evidence. No LLM in the critical path. Evaluator checks: viable hypotheses cite a signal, citations reference stored sources, affinity within range, economics identity holds, rejections carry reasons, sample mode never yields high/medium labels, approval gate present.

## Scoring
`src/lib/business/scoring.ts`: weights taste 0.30, operational 0.25, feasibility 0.15, economics 0.20, evidence 0.10. Baseline (no Qloo) uses operational/feasibility/economics × generic priority. Labels: `high | medium | low | requires_validation | not_recommended` (sample mode caps at requires_validation). Rank delta and `changedBy` citations are persisted per hypothesis.

## Economics
`src/lib/business/margin.ts`: formulas from the brief, fee bases applied once to net price, cannibalization subtracted after contribution, break-even null when per-unit contribution ≤ 0, one-at-a-time ±20% sensitivity. 8 unit tests.

## Security
RLS on all 18 tables; membership predicates via `security definer` helpers; demo tenant world-readable, writes only through rate-limited server routes using the service role; `decision_events` immutable by trigger; operational tables have no policies (service role only). Security headers in `next.config.ts` and `src/proxy.ts`. Secrets server-only.

## TastePass
`supabase/migrations/0005_tastepass.sql`: `campaigns` (RLS: read follows the restaurant, demo world-readable; write members only) and `pass_claims` (select for members only; no insert/update policies). `claim_pass()` locks the campaign row and checks status, window, cap and a per-network limit; `redeem_pass()` is one conditional `UPDATE … WHERE status='claimed' AND expires_at > now()`, so concurrent redemptions count once (integration test runs 5 in parallel). Both functions are executable by `service_role` only and are called from rate-limited route handlers. Codes: 8 chars from an alphabet without 0/O/1/I. Economics: `src/lib/business/tastepass.ts` (contribution = offer × (1 − fee) − variable cost; break-even = ceil(fixed / contribution); NO-GO when contribution ≤ 0), recomputed server-side on create. Proof dashboard polls `/api/campaigns/[id]/stats` every 3 s (aggregates only, never codes). Public view counter: one count per hashed IP per 30 minutes.
