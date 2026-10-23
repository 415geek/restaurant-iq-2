# BUILD_BASELINE — Restaurant IQ 2.0 / Taste-to-Profit Agent

Date: 2026-10-23 (PT). Deadline: 2026-10-30 23:45 ET (Devpost, verified from rules page).

## 1. Repository state (evidence)

- Working directory `/Users/c8geek/Qloo Agentic Hackathon` was **empty** and **not a git repo**. Owner confirmed: "这是一个全新的 从0-1的项目" (greenfield 0→1 build).
- `git init -b main` executed 2026-10-23. No prior commits, no proprietary code in this tree.
- Older Restaurant IQ codebases exist elsewhere on this machine (Next.js 16 app in `~/Downloads/restaurantiq-amazon`, Python agents in `~/restaurant os`, etc.). They are **not** reused: the owner asked for a from-zero build, and reusing them would risk leaking private IP into a public hackathon repo (prompt §14).
- Security note (no values printed): one old backup repo under `~/LocalBackups/dyad-apps/` stores a GitHub OAuth token inside its git remote URL. Recommend rotating that token. Unrelated to this project.

## 2. Toolchain (verified by running the commands)

| Tool | Version | Note |
|---|---|---|
| bun | 1.3.11 | package manager + runtime for scripts |
| node | v24.13.1 (nvm) | needed by Next.js tooling |
| pnpm / npm | 10.29.3 / 11.8.0 | available |
| git | 2.50.1 | |
| gbrain | 0.48.1.0 | already installed, PGLite engine |
| supabase CLI | 2.75.0 | |
| vercel CLI | not installed | use `bunx vercel` or Vercel MCP |
| gh CLI | installed, **not logged in** | needed to create the public repo |

Latest registry versions checked 2026-10-23: next 16.4.3, react 19.3.1, @supabase/supabase-js 2.118.0, @supabase/ssr 0.12.7, zod 4.6.7, vitest 5.0.5, @playwright/test 1.64.1, tailwindcss 4.3.3, @anthropic-ai/sdk 1.2.0.

## 3. Credentials / services (names only)

| Item | Status | Evidence |
|---|---|---|
| `QLOO_API_KEY` | **MISSING** | not in env, not in any `.env*` under `~` (depth 4) |
| Supabase | 2 projects in org: `app-restaurantiq` (ACTIVE, us-west-2, **in production use by the old app**: 15 tables incl. telemetry, cost log, settings) and `Restaurant-IQ-APP` (INACTIVE) | Supabase MCP `list_projects` / `list_tables` |
| Vercel | teams `c8geek` and `c8geeks-projects`; existing `app-restaurantiq` projects in both (old app) | Vercel MCP `list_projects` |
| `ANTHROPIC_API_KEY` | not found | optional (LLM narrative only; core flow is deterministic) |
| GitHub | `gh` not authenticated | needed for public repo + Vercel git deploy |

## 4. GBrain (developer memory) baseline

- Config: `~/.gbrain/config.json` → engine `pglite`, schema pack `gbrain-base-v2`, `embedding_disabled: true` (keyword-only search, no paid APIs), protocol installed 2026-09-02. Brain already initialized, so `gbrain init` and the search-mode matrix prompt do **not** apply (re-initializing would overwrite a configured brain).
- Server: one `gbrain serve --http --bind 127.0.0.1 --port 3131 --surface verbs` process (PID observed) owns the PGLite lock. Claude Code is wired through a global HTTP MCP entry `gbrain` in `~/.claude.json` (bearer token, not printed).
- MCP tools discovered in this session: recall, remember, forget, context_pack, entity, synthesize, delta.
- Smoke test (this session, real MCP calls): remember nonce → `inserted` id 3; recall by entity+grep → exact phrase returned with provenance; corrected fact → id 4; forget 3 and 4 → `expired: true`. Details in `docs/dev-memory/SETUP.md`.
- Gotcha: running `gbrain engine status` / `gbrain recall` from the CLI while the HTTP server owns PGLite hangs (observed). Use MCP tools, not the CLI, while the server runs.

## 5. Hackathon rules (verified from qloo.devpost.com/rules, fetched 2026-10-23)

- Deadline: Oct 30, 2026 11:45 pm EDT. Must integrate Qloo API and be agentic. New or substantially updated with Qloo during the period.
- Must submit: link to a **hosted** functional demo (local-only disqualified), **public** repo with **open-source license visible in About**, text description. No video required.
- Judging: 4 equal criteria (technological implementation, design, potential impact, quality of idea).
- Hackathon API: base `https://hackathon.api.qloo.com`, header `X-Api-Key`, GET only, keys via Google form, "Don't store Qloo response data in a public repository" → sample fixtures must be synthetic, never captured responses.

## 6. Qloo API contract (from docs.qloo.com, see docs/architecture/CONTRACTS.md)

Verified endpoints: `GET /v2/insights` (filter.type required), `GET /search`, `GET /v2/tags`, `GET /entities`, `GET /v2/audiences` (spec flags deprecated; docs still reference). The `openapi-schema.json` in `qloo/docs-public` is the generic OpenAPI 3.1 meta-schema, **not** Qloo's API spec, so the typed adapter is handwritten from reference pages and must be confirmed with a live call once a key exists.

## 7. Gaps / risks

1. No Qloo key → live mode blocked until the owner obtains one (form link in CONTRACTS.md). Sample mode is built first and labeled.
2. Per-entity `query.affinity` shape for place results is not shown in docs samples → normalizer tolerates absence; live verification task recorded.
3. New Supabase project and new Vercel project are new resources → owner authorization required (prompt §1.7).
4. 7 days to deadline → scope locked to P0; P1 only after P0 gates pass.

## 8. Scoped implementation plan

See `plan.json` (gates G0–G8) and `docs/BUILD_PROGRESS.md`.
