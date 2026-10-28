# BUILD_PROGRESS (durable handoff)

Updated: 2026-10-27 (PT) · Deadline: 2026-10-30 23:45 ET (20:45 PT)

## Phase
G0–G6 ✅ · **G3 live ✅ (Qloo key received 2026-10-27; demo analysis regenerated live)** · **TastePass ✅ (migration 0005, activate → claim → redeem → live proof)** · **Cultural anchor ✅** · G7 ⏸ blocked on owner (GitHub repo + Vercel login)

## Passing checks (run 2026-10-27)
lint ✅ · typecheck ✅ · unit 52 ✅ · integration (live Supabase: RLS 3 + TastePass 5) ✅ · build ✅ · E2E 30 (28 pass, 2 desktop-only skips on phone projects) ✅

## Blockers (owner)
1. Public GitHub repo: `gh auth login`, then `gh repo create restaurant-iq-2 --public --source . --push`.
2. Vercel: `bunx vercel login`, then `vercel --prod` with env vars (Supabase URL/anon/service role, `QLOO_API_KEY`, `QLOO_BASE_URL`).
3. Supabase Auth: add the production URL to redirect URLs.

## Product pivot (2026-10-27)
Positioning moved from "decision report" to **TastePass: Qloo affinity → owner-approved offer → real redemption signal**. Reason: comparable entries (TasteTest, Carte Locale, Overlap, Encore) stop at recommendations; none closes the loop to a measured outcome. Plan: `~/.claude/plans/swirling-dancing-acorn.md`.

## Evidence
`docs/tests/TEST_REPORT.md`, `docs/evidence/screenshots/*.png`, `docs/security/REVIEW.md`, `docs/dev-memory/SETUP.md`

## Next three actions
1. Deploy (git-connected Vercel) and record the URL in `docs/hackathon/SUBMISSION.md`; run Playwright against prod with `E2E_BASE_URL`.
2. Seed one approved sandbox pass for cold-start judges; clean test campaigns from the demo tenant.
3. Regenerate screenshots (`scripts/screenshots.ts`) incl. TastePass pages; README hero image.
