# Deployment runbook

## Environments
- Supabase project `restaurant-iq-2` (ref `lecxfiybvojpdsgazttn`, us-west-1). Migrations applied: `0001_core`, `0002_rls`; seed applied.
- Vercel project `restaurant-iq-2` (team `c8geek`) — creation via MCP was refused (403); see "Deploy" below.

## Env vars (names only)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `QLOO_API_KEY`, `QLOO_BASE_URL`, `QLOO_DAILY_CALL_CAP`, `QLOO_CACHE_TTL_SECONDS`, `DEMO_RATE_LIMIT_PER_10MIN`, optional `ANTHROPIC_API_KEY`.

## Deploy (git-connected, preferred)
1. `gh auth login` → `gh repo create restaurant-iq-2 --public --source . --push`.
2. Vercel dashboard → New project → import the repo (or `vercel link` + `vercel --prod` after `vercel login`). Framework: Next.js, install `bun install`.
3. Set env vars for Production + Preview. Set `NEXT_PUBLIC_APP_URL` to the production URL.
4. Supabase → Auth → URL configuration: add `https://<prod-domain>/auth/callback` to redirect URLs; set Site URL.
5. Smoke: `/api/health` → `{ ok: true, supabase: "configured" }`; open `/demo`; run analysis; check `/r/<demo>/memory`.
6. Playwright against prod: `E2E_BASE_URL=https://<prod-domain> bunx playwright test`.

## Rollback
Vercel → Deployments → promote previous. Database migrations are additive; no destructive change has shipped.

## Cost guards
Qloo: cache 24 h, `QLOO_DAILY_CALL_CAP` (default 400), concurrency 4. Demo: 5 analysis runs / 10 min / IP. Supabase: free-tier sized tables, indexes on all FK/time columns.
