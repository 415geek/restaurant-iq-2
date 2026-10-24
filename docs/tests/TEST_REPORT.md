# Test report — 2026-10-24 (all commands actually run)

| Check | Command | Result |
|---|---|---|
| Lint | `bun run lint` | ✅ 0 errors, 0 warnings |
| Typecheck | `bun run typecheck` (next typegen + tsc) | ✅ |
| Unit | `bun run test -- tests/unit` | ✅ 7 files, 40 tests (Qloo client/normalizer/guard/provider, margin, scoring, validation, orchestrator) |
| Integration (RLS, live Supabase) | `bun run test -- tests/integration` | ✅ 3 tests (cross-tenant denial, immutability, operational tables hidden) |
| Build | `bun run build` | ✅ Next.js 16.4.3, 21 routes |
| E2E | `E2E_BASE_URL=http://localhost:3000 bunx playwright test` | ✅ 24 passed (8 specs × desktop 1440 / mobile 375 / mobile 390): judge path, provenance, with/without toggle, not-recommended with reasons, Decision Lab recompute, approval-gated task, memory event, auth redirect, health, no horizontal overflow |
| Demo analysis against live Supabase | `bun scripts/run-demo-analysis.ts` | ✅ run completed, 3 viable, evaluator passed (sample mode) |
| Qloo live smoke | `/api/qloo/verify` | ⏸ **live-untested** — no `QLOO_API_KEY` yet |
| Hosted smoke | — | ⏸ pending deployment |

Not covered yet: owner login + persist decision E2E (needs a mail-less auth path; covered manually via API routes + RLS tests), CSV import (P1).
