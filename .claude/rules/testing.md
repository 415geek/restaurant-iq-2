# Testing rules

- Unit (vitest, `tests/unit`): economics (positive/negative/zero/0-100% cannibalization/fees), scoring + reject path, Qloo normalizer + error states (no key, timeout, 429, empty, malformed), action state machine, validation schemas.
- Integration (`tests/integration`): orchestrator end-to-end in sample mode; RLS cross-tenant denial (needs local Supabase or remote dev project).
- E2E (Playwright, `tests/e2e`): judge happy path, login + persist decision, scenario inputs change numbers, sources/freshness visible, one not-recommended hypothesis, 375/390 px viewports, no console errors.
- Live Qloo smoke test runs only when `QLOO_API_KEY` is set; otherwise it is reported as `live-untested`.
- Never report a check as passing unless the command was run in this session.
