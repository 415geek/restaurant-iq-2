# Token efficiency — proxy measurement (honest)

Claude Code does not expose per-call token accounting to the session, so the figures below are **byte-count proxies of tool output**, measured on this repository on 2026-10-24, not API token/cost metrics.

| Task (identical prompt) | Baseline: scan + read | Memory-assisted: recall + targeted read | Proxy saving |
|---|---|---|---|
| "Where is the Qloo base URL and auth header configured?" | `find src -type f` (2.1 KB) + read `client.ts` (6.4 KB) = 8.5 KB | recall entity fact #6 (0.4 KB) + `rg QLOO_DEFAULT_BASE_URL` (0.2 KB) = 0.6 KB | ≈93% |
| "Which Supabase project/ref does this app use and which migrations are applied?" | read `docs/BUILD_BASELINE.md` (6 KB) + `ls supabase/migrations` (0.1 KB) = 6.1 KB | recall fact #8 (0.3 KB) = 0.3 KB | ≈95% |
| "Why can't I run `gbrain` CLI while the server is up?" | read `docs/dev-memory/SETUP.md` (3 KB) | recall fact #7 (0.3 KB) | ≈90% |

Method: byte sizes of the tool results that would be loaded into context for each approach; GBrain calls add one MCP round-trip (<1 s each, keyword search, embeddings disabled). Latency and API tokens were not measurable in-session; treat the percentages as output-size proxies only.
