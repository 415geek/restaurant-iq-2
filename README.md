# TastePass by Restaurant IQ

> Turn culture into customers. Prove what works.

A Qloo-powered agent for independent restaurants, built for the **Qloo Agentic Hackathon 2026**. It reads Qloo taste data for a restaurant's neighborhood, ranks costed ideas, turns one into an **owner-approved TastePass** (public link + QR code), and counts **real claims and merchant-verified redemptions**. It never claims that taste affinity predicts purchases, and it is not a POS.

- **Live demo:** see `docs/hackathon/SUBMISSION.md` (URL recorded there once deployed)
- **Judge guide (3 minutes, no account):** `docs/hackathon/JUDGE_GUIDE.md`
- **License:** MIT

## What it does

1. **Read the taste (Qloo, live):** `/v2/tags` resolves the cuisine to restaurant genre tags; `/v2/insights` returns place-attribute tags by type (genre, ambience, customer identity, dishes), nearby places with `feature.explainability`, cross-domain brands, podcasts, artists and shows, and age/gender skew. Every result is stored with provenance (endpoint, params, timestamp, cache hit, mode).
2. **Cultural anchor:** the owner types an artist, film, show, brand or podcast. Qloo `/search` resolves it; `/v2/insights` with `signal.interests.entities` returns the city's restaurants whose audience overlaps that anchor's fans, with explainability, plus the fans' demographics.
3. **Moments (local calendar):** holidays computed in code (US, California, retail and cultural dates such as Lunar New Year and Diwali) plus live San Francisco open data: street-closure permits for street fairs, block parties, markets and races (DataSF `v9cz-kk5i`) and community-organization events (Our415, `8i3s-ih2a`), sorted by distance from the restaurant. Each event is mapped to a theme (kids, farmers market, night market, running…) and Qloo returns the age/gender skew of people who like that theme. A deterministic cosine score compares it with the cuisine's audience ("Strong overlap" / "Different crowd"), and the pass form is pre-timed to that date.
4. **Pick one idea, costed:** a bounded six-agent workflow (Intake → Evidence → Opportunity → Finance → Execution → Evaluator) scores a cuisine-agnostic catalog on taste fit, operational fit, feasibility, deterministic economics and evidence quality. Constraints such as "no liquor license" reject ideas with reasons. A With/Without Qloo toggle shows exactly which returned signal moved each idea.
5. **Activate a TastePass:** the owner edits offer, price, food cost, fees, fixed test spend, cap and dates. Profit per redemption and break-even recompute deterministically; a **NO-GO** (zero or negative contribution) cannot be approved. Approval records an approval row, a launch task and a memory event.
6. **Prove it:** a public, mobile-first pass page (`/p/[slug]`, no account, no PII) issues a one-time 8-character code. The merchant redeems it at the counter; a Postgres function makes redemption atomic and idempotent. The proof dashboard updates every 3 seconds: views, claims, redemptions, conversion, optional verified sale amount, next to **what this does not prove**.
7. **Business memory:** every analysis, anchor lookup, approval, claim and redemption is an immutable event.

## Languages & design

UI and all generated content (hypotheses, citations, playbooks, tasks, decision events) render in **English, 中文 and Español** via keyed templates (`src/i18n`). Locale cookie `riq_locale`; switcher in the header / rail. Visual system follows the Restaurant IQ brand guide (coral `#FF6B35`, navy `#1B2A4A`, Plus Jakarta Sans / Noto Sans SC): white card UI, five-step journey bar, Why · Numbers · Plan slide-over, info tooltips instead of inline explanations. See `DESIGN.md`.

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
