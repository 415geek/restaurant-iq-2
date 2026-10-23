# Restaurant IQ 2.0 — Taste-to-Profit Agent (project rules)

Greenfield hackathon build (Qloo Agentic Hackathon, deadline 2026-10-30 23:45 ET). Owner: restaurant SaaS BD professional; reports to owner in Chinese, product in English.

## Stack (do not swap)
Next.js 16 App Router, TypeScript strict, Tailwind 4, Supabase (Postgres + Auth + RLS), zod 4, vitest, Playwright, bun. Deploy: Vercel.

## Non-negotiables
- Qloo calls are server-only (`QLOO_API_KEY`), via `src/lib/providers/qloo`. Base URL `https://hackathon.api.qloo.com`, header `X-Api-Key`, GET only.
- Never fabricate Qloo numbers. Sample mode is labeled "Sample dataset — illustrative, not live Qloo data" and fixtures are synthetic (hackathon rule: no stored Qloo responses in the public repo).
- Live mode never silently falls back to fixtures after a failure; it fails loud with provider state.
- Economics are deterministic TypeScript in `src/lib/business/margin.ts`; LLMs never compute totals.
- Every table has RLS with membership predicates. Service-role key only in server code.
- No promises of profitability. Show evidence, assumptions, uncertainty, and "do not pursue" paths.
- Every visible CTA works or is disabled with a reason.

## Workflow
1. Before touching an area, read `docs/BUILD_PROGRESS.md` and `docs/architecture/REPO_MAP.md` headings; then rg the relevant module only.
2. Recall durable decisions from GBrain (entity `projects/restaurant-iq-2`) via MCP; verify against code (git is source of truth).
3. After each change run the focused check (`bun run typecheck`, `bun run test -- <path>`); before milestones run `bun run lint && bun run typecheck && bun run test && bun run build`.
4. Update `docs/BUILD_PROGRESS.md` at milestones; store only durable decisions in GBrain with provenance. No secrets, no customer data, no transcripts.
5. While the GBrain HTTP server runs, use MCP tools, never `gbrain` CLI DB commands (they hang on the PGLite lock).

## Pointers
- Contracts: `docs/architecture/CONTRACTS.md` · Decisions: `docs/architecture/DECISIONS.md` · Map: `docs/architecture/REPO_MAP.md`
- Plan: `plan.json` · Baseline: `docs/BUILD_BASELINE.md`
- Rules: `.claude/rules/architecture.md`, `.claude/rules/testing.md`
