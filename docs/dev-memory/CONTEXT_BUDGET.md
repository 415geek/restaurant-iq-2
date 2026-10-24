# Context budget & selective retrieval protocol

1. Start: read `docs/BUILD_PROGRESS.md` + `docs/architecture/REPO_MAP.md` headings (≈2 KB), then `mcp__gbrain__recall` on entity `projects/restaurant-iq-2` (≈1 KB).
2. Locate code with `rg`/Grep on symbol names; read only the slice needed.
3. Never cat lockfiles, `.next/`, screenshots, or full test output; tail the last ~20 lines.
4. Store to GBrain only durable decisions with provenance (stack, infra refs, contracts, owner decisions). Never secrets, rows, transcripts, Qloo payloads.
5. Update canonical docs at milestones; GBrain facts point to docs rather than duplicating them.

Always-loaded: `CLAUDE.md` (≈45 lines) + `.claude/rules/*` (≈20 lines). Everything else on demand.
