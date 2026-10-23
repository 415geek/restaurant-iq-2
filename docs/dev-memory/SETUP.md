# Developer memory (GBrain) — setup evidence

Status: **ACTIVE, pre-existing installation reused** (not re-initialized). Verified 2026-10-23.

| Check | Result | Evidence |
|---|---|---|
| Binary | `~/.bun/bin/gbrain`, version 0.48.1.0 | `gbrain --version` |
| Engine | PGLite at `~/.gbrain/brain.pglite`, schema `gbrain-base-v2` | `~/.gbrain/config.json` |
| Embeddings | disabled (`embedding_disabled: true`); keyword-only recall; no paid APIs | config |
| Search mode matrix | not shown: brain initialized 2026-09-02, re-running `gbrain init` would overwrite it | config `protocol_installed_at` |
| Server | one process: `gbrain serve --http --bind 127.0.0.1 --port 3131 --surface verbs` | `lsof -iTCP:3131` |
| Claude Code wiring | global MCP server `gbrain` (type http, bearer header) in `~/.claude.json` | inspected, token not recorded here |
| Tools discoverable | recall, remember, forget, context_pack, entity, synthesize, delta | tool list in session |
| Auto-capture / daemons / connectors / paid enrichment | none added | — |

## Persistence & correction test (real MCP calls, 2026-10-23)

1. `remember` fact "…amber-orbit-riq-7f3c9e-20261023…" entity `projects/restaurant-iq-2`, provenance "explicit GBrain setup test, Claude Code session 2026-10-23" → `status: inserted`, id 3.
2. `recall` entity `projects/restaurant-iq-2` grep `amber-orbit` → returned exact phrase + provenance (same session).
3. `remember` corrected phrase (…-CORRECTED) → id 4 (`degraded_dedup: true` because embeddings are off; dedup is keyword-based).
4. `forget` id 3 and id 4 → `expired: true` (audit trail kept, as upstream documents).

**PENDING USER VERIFICATION (new session):** open a fresh Claude Code conversation in this folder and ask:
"Use the gbrain recall tool on entity projects/restaurant-iq-2 with include_expired true and tell me the test phrase." A real `recall` call should return the expired nonce facts (ids 3, 4). This proves cross-session persistence independently of this transcript.

## Operating rules

- While the HTTP server holds the PGLite lock, **do not** run `gbrain` CLI commands that open the DB (`engine status`, `recall`, `remember`): they hang. Use the MCP tools.
- Never start a second server on the same PGLite brain. Never delete `.gbrain-resolve.sock` or lock files.
- Store only durable architectural decisions with provenance (entity `projects/restaurant-iq-2`). No secrets, no customer rows, no transcripts, no Qloo response payloads.
