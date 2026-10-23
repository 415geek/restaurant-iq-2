# BUILD_PROGRESS (durable handoff)

Updated: 2026-10-23 (PT) · Deadline: 2026-10-30 23:45 ET

## Phase
G0 done · G1 done (new-session recall check pending owner) · **G2 next** (blocked on Supabase project decision; migrations can be written meanwhile)

## Passing checks (run this session)
- `bun install` ✅ · `bun run lint` ✅ · `bun run build` ✅ (scaffold) · `bun run typecheck` ✅ after build (Next 16 generates `LayoutProps` into `.next/types`; run build or `next typegen` first) — all run 2026-10-23

## Blockers (owner)
1. `QLOO_API_KEY` missing → live Qloo blocked; sample mode proceeds.
2. Approve new Supabase project `restaurant-iq-2` (existing `app-restaurantiq` is in production use).
3. Approve new Vercel project + new public GitHub repo (`gh auth login` needed).
4. Approve MIT license.

## Evidence
- `docs/BUILD_BASELINE.md`, `docs/dev-memory/SETUP.md`, `docs/architecture/CONTRACTS.md`, `plan.json`

## Next three actions
1. Write `supabase/migrations/0001_core.sql` + `0002_rls.sql` + seed (demo tenant) and RLS tests.
2. Implement `src/lib/providers/qloo/*` (typed client, normalizer, guard, synthetic fixtures) + unit tests.
3. Implement `src/lib/business/margin.ts` + scoring/reject + unit tests; then agents orchestrator.
