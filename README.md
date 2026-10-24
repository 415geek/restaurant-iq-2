# Restaurant IQ 2.0 — Taste-to-Profit Agent

> Your POS runs your restaurant. Restaurant IQ grows your business.

An independent commercial decision brain for independent restaurants, built for the **Qloo Agentic Hackathon 2026**. It turns cross-domain taste intelligence from the Qloo Insights API into ranked, costed, testable opportunity hypotheses, with execution playbooks, approval-gated tasks and a lasting business-decision memory. It is not a POS and never promises profitability.

- **Live demo:** see `docs/hackathon/SUBMISSION.md` (URL recorded there once deployed)
- **Judge guide:** `docs/hackathon/JUDGE_GUIDE.md`
- **License:** MIT

## What it does

1. **Intake** a restaurant (cuisine, neighborhood, formats, hours, menu costs, objective, constraints). No POS required.
2. **Evidence (Qloo):** server-side calls to `/v2/tags`, `/v2/insights` (place attributes, cross-domain brands/podcasts/artists/shows, demographics, nearby places with `feature.explainability`). Every result is stored with provenance (endpoint, redacted params, timestamp, TTL, live/sample mode).
3. **Opportunity engine:** a deterministic scorer over a cuisine-agnostic hypothesis catalog. Dimensions: taste fit, operational fit, feasibility, economics, evidence quality. Produces up to three viable hypotheses, marks the rest **not recommended** with reasons, and can return **no viable opportunity**.
4. **With Qloo vs without Qloo:** the same catalog ranked twice. The UI names the exact returned signal that moved each recommendation.
5. **Decision Lab:** deterministic unit economics (contribution margin, break-even, cannibalization, sensitivity). LLMs never compute totals.
6. **Action board:** draft → needs approval → ready → in progress → completed. Anything external waits for a human approval row.
7. **Business memory:** immutable decision events with evidence snapshots and assumptions.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (Postgres, Auth, RLS) · zod · vitest · Playwright · bun · Vercel.

## Run locally

```bash
bun install
cp .env.example .env.local   # fill Supabase + optional QLOO_API_KEY
bun run dev                  # http://localhost:3000
```

Database: apply `supabase/migrations/0001_core.sql`, `0002_rls.sql`, then `supabase/seed.sql` (synthetic demo tenant) to your Supabase project. Then `bun scripts/run-demo-analysis.ts` seeds the demo run.

Without `QLOO_API_KEY` the app runs in **sample mode**: synthetic fixtures labeled "Sample dataset — illustrative, not live Qloo data" on every card. With a hackathon key (`https://hackathon.api.qloo.com`, header `X-Api-Key`) it runs live and never substitutes fixtures on failure.

## Checks

```bash
bun run lint && bun run typecheck && bun run test && bun run build
E2E_BASE_URL=http://localhost:3000 bunx playwright test   # after `bun run start`
```

See `docs/tests/TEST_REPORT.md` for the latest recorded results.

## Repo map

`src/lib/providers/qloo` (typed client, normalizer, usage guard, synthetic fixtures) · `src/lib/business` (margin, scoring, catalog) · `src/lib/agents` (bounded orchestrator + stores) · `src/app` (routes) · `supabase/` (migrations, RLS, seed) · `tests/` · `docs/`.

## Honesty rules baked in

Affinity is Qloo's 0–1 relation, shown as such and never as demand. Sample mode caps every label at "requires validation". Live failures fail loud. Economics are arithmetic. Every CTA works or is disabled with a reason.
