# BUILD_PROGRESS (durable handoff)

Updated: 2026-10-28 (PT) · Deadline: 2026-10-30 23:45 ET (20:45 PT)

## Phase
G0–G6 ✅ · **G3 live ✅ (Qloo key received 2026-10-27; demo analysis regenerated live)** · **TastePass ✅ (migration 0005, activate → claim → redeem → live proof)** · **Cultural anchor ✅** · **Moments ✅ (migrations 0006–0007; holidays + Nager.Date + SF/NYC/Chicago open data + SerpApi web events, daily rolling snapshot via cron; Qloo crowd fit → timed pass)** · **Sales data + Business Brain ✅ (migration 0008; multi-file upload, rules/memory/AI mapping, PII drop, deterministic analysis → actions)** · **Review fixes ✅ (migration 0009: worst-case loss, controlled With/Without Qloo, campaign decision basis + transactional idempotent create, sales grain/dedupe/atomic import, AI redaction, evaluator gate, first-screen experiment card)** · G7 ⏸ blocked on owner (GitHub repo + Vercel login)

## Passing checks (run 2026-10-28)
lint ✅ · typecheck ✅ · unit + integration 112 ✅ · build ✅ · E2E 45 (37 pass, 8 desktop-only skips on phone projects) ✅

## Blockers (owner)
1. ✅ Public repo: https://github.com/415geek/restaurant-iq-2 (MIT, created 2026-10-28).
2. ✅ Production: https://restaurant-iq-2.vercel.app (Vercel hobby team `c8geeks-projects`, deployed 2026-10-28; full Playwright suite green against prod: 37 pass, 8 desktop-only skips). Deploy again with `bunx vercel deploy --prod --scope c8geeks-projects`. Env vars with env vars (Supabase URL/anon/service role, `QLOO_API_KEY`, `QLOO_BASE_URL`, `CRON_SECRET`, `SERPAPI_API_KEY`). `vercel.json` registers the daily cron.
5. `ANTHROPIC_API_KEY` is empty: AI column mapping and PDF/photo reading are disabled (shown with a reason). Rules handle the sample files.
4. SerpApi free plan for this key is exhausted until 2026-11-04 (250/250 used). Web events show "quota used up" until then.
3. Supabase Auth (owner, dashboard): add `https://restaurant-iq-2.vercel.app/**` to Authentication → URL Configuration → Redirect URLs (the demo needs no login).

## Product pivot (2026-10-27)
Positioning moved from "decision report" to **TastePass: Qloo affinity → owner-approved offer → real redemption signal**. Reason: comparable entries (TasteTest, Carte Locale, Overlap, Encore) stop at recommendations; none closes the loop to a measured outcome. Plan: `~/.claude/plans/swirling-dancing-acorn.md`.

## Evidence
`docs/tests/TEST_REPORT.md`, `docs/evidence/screenshots/*.png`, `docs/security/REVIEW.md`, `docs/dev-memory/SETUP.md`

## Next three actions
1. Deploy (git-connected Vercel) and record the URL in `docs/hackathon/SUBMISSION.md`; run Playwright against prod with `E2E_BASE_URL`.
2. Seed one approved sandbox pass for cold-start judges; clean test campaigns from the demo tenant.
3. Regenerate screenshots (`scripts/screenshots.ts`) incl. TastePass pages; README hero image.
