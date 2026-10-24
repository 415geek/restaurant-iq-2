# BUILD_PROGRESS (durable handoff)

Updated: 2026-10-24 (PT) · Deadline: 2026-10-30 23:45 ET

## Phase
G0 ✅ · G1 ✅ (new-session recall check pending owner) · G2 ✅ · G3 ✅ sample mode / ⏸ live (no key) · G4 ✅ · G5 ✅ · G6 ✅ (unit 40, integration 3, E2E 24) · **G7 ⏸ blocked on owner (GitHub repo + Vercel)** · G8 docs written

## Passing checks (run 2026-10-24)
lint ✅ · typecheck ✅ · unit 40 ✅ · integration (live Supabase RLS) 3 ✅ · build ✅ · E2E 24 ✅ (desktop/375/390) · demo analysis persisted ✅

## Blockers (owner)
1. `QLOO_API_KEY` — request via the hackathon form; then set in `.env.local` + Vercel, run `/api/qloo/verify`, re-run demo analysis.
2. Public GitHub repo: `gh auth login`, then `gh repo create restaurant-iq-2 --public --source . --push`.
3. Vercel: MCP project creation returned 403; use dashboard import or `vercel login` + `vercel --prod`.

## Evidence
`docs/tests/TEST_REPORT.md`, `docs/evidence/screenshots/*.png`, `docs/security/REVIEW.md`, `docs/dev-memory/SETUP.md`

## Next three actions
1. Deploy (git-connected) and record the URL in `docs/hackathon/SUBMISSION.md`; run Playwright against prod.
2. Live Qloo verification once the key arrives; confirm per-entity `query.affinity` shape; adjust normalizer if needed.
3. P1: outcome-logging UI + printable decision brief.
