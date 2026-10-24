# Security review (2026-10-24)

| Area | Status | Evidence |
|---|---|---|
| RLS on every exposed table | ✅ | `supabase/migrations/0002_rls.sql`; integration test `tests/integration/rls.test.ts` passed against the live project (anon can read demo, cannot write; user B cannot read/edit user A's restaurant; anon cannot read `usage_events`/`provider_cache`) |
| Service role key server-only | ✅ | `src/lib/db/server.ts` imports `server-only`; never `NEXT_PUBLIC_` |
| Qloo key server-only | ✅ | only read in `createQlooProvider` (server routes/scripts) |
| Demo abuse guards | ✅ | `/api/analysis`: 5 runs / 10 min per IP (demo), 20 for members; mutations 20 / 10 min; Qloo daily cap + concurrency cap |
| Input validation | ✅ | zod schemas in `src/lib/validation/schemas.ts`; JSON parse guarded; UUID checks |
| Authorization on every mutation | ✅ | `authorizeRestaurant()` (membership or demo) before any write |
| Immutable audit | ✅ | `decision_events` update/delete raises (trigger) |
| Security headers | ✅ | nosniff, referrer-policy, X-Frame-Options DENY, permissions-policy (`next.config.ts` + proxy) |
| Prompt injection | n/a now | No LLM in the critical path; external content never becomes instructions |
| Secrets in repo | ✅ | `.env*` ignored; `.env.example` has names only |
| `SECURITY DEFINER` functions | reviewed | `is_org_member`, `can_read_restaurant`, `can_write_restaurant`, `create_organization` — fixed `search_path`, minimal logic, `create_organization` requires `auth.uid()` |
| Supabase advisors | ✅ | 2026-10-24: helper functions moved to non-exposed `private` schema, trigger functions got fixed `search_path`, `create_organization` revoked from anon (`0003_hardening.sql`); remaining INFO: operational tables intentionally have no policies (service role only) |

Known limitations: rate limiting is per-IP (shared NAT users share a bucket); no CAPTCHA; email OTP relies on Supabase default rate limits.
