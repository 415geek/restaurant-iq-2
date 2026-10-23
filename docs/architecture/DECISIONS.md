# Decisions log

| Date | Decision | Why | Provenance |
|---|---|---|---|
| 2026-10-23 | Greenfield repo in `/Users/c8geek/Qloo Agentic Hackathon`; old Restaurant IQ code not reused | Owner: 从0-1; public-repo IP isolation | owner chat, BUILD_BASELINE §1 |
| 2026-10-23 | Stack: Next.js 16 + TS + Tailwind 4 + Supabase + bun; Vercel | Fastest hosted path with auth+RLS; matches owner's existing accounts | BUILD_BASELINE §2–3 |
| 2026-10-23 | Reuse existing GBrain (no re-init); MCP via HTTP server on :3131 | Re-init would overwrite a configured brain | dev-memory/SETUP.md |
| 2026-10-23 | Deterministic opportunity + economics engine; LLM optional for narrative only | Prompt §5/§8; no ANTHROPIC key available; judges must see non-fabricated numbers | plan.json |
| 2026-10-23 | Sample fixtures are synthetic, never captured Qloo payloads | Hackathon rule: no Qloo response data in public repo | CONTRACTS.md |
| 2026-10-23 | License MIT (draft, pending owner approval) | Devpost requires visible OSS license | rules page |
