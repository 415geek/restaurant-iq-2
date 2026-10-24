# Repo map (keep headings stable; update at milestones)

- `src/app/` — routes: `/` landing, `/demo`, `/login`, `/app/**` (auth), `/api/**`
- `src/lib/providers/qloo/` — client, types, normalizer, usage guard, synthetic fixtures
- `src/lib/providers/pos/` — connector interface (planned, not connected)
- `src/lib/agents/` — orchestrator + Intake/Evidence/Opportunity/Finance/Execution/Evaluator, budget, trace
- `src/lib/business/` — margin (deterministic economics), scoring, decision/reject logic
- `src/lib/db/` — Supabase clients (server/service-role, browser), generated types
- `src/lib/auth/`, `src/lib/validation/`, `src/lib/telemetry/`
- `src/components/` — ui (primitives, Icon, InfoTip), shell (WorkspaceShell rail/bottom tabs, StepBar, DataPill, LocaleSwitch), taste (tiles + CompareRanking), opportunity (Deck + Sheet, LabCore, PlanView, DecideButtons), actions, memory, auth, onboarding, evidence (TrustPanel)
- `src/i18n/` — en/zh/es dictionaries (514 keys), server `getT()`, client `useI18n()`, `formatLText` for keyed generated content
- `supabase/migrations/` — 0001 core schema, 0002 RLS; `supabase/seed.sql` demo tenant · `scripts/` — run-demo-analysis, screenshots
- `tests/unit`, `tests/integration`, `tests/e2e`
- `docs/` — baseline, progress, architecture, dev-memory, product, security, tests, deployment, hackathon
