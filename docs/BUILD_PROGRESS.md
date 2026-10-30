# BUILD_PROGRESS (durable handoff)

Updated: 2026-10-28 (PT) · Deadline: 2026-10-30 23:45 ET (20:45 PT)

## Phase
G0–G6 ✅ · **G3 live ✅ (Qloo key received 2026-10-27; demo analysis regenerated live)** · **TastePass ✅ (migration 0005, activate → claim → redeem → live proof)** · **Cultural anchor ✅** · **Moments ✅ (migrations 0006–0007; holidays + Nager.Date + SF/NYC/Chicago open data + SerpApi web events, daily rolling snapshot via cron; Qloo crowd fit → timed pass)** · **Sales data + Business Brain ✅ (migration 0008; multi-file upload, rules/memory/AI mapping, PII drop, deterministic analysis → actions)** · **Review fixes ✅ (migration 0009: worst-case loss, controlled With/Without Qloo, campaign decision basis + transactional idempotent create, sales grain/dedupe/atomic import, AI redaction, evaluator gate, first-screen experiment card)** · **Execution positioning + experiment review ✅ (2026-10-28 PM: 4-stage bar Signals → Recommend → Execute → Prove, press-and-hold approve, Stop TastePass, landing copy; POS experiment review per pass vs 4 prior same-hour weeks)** · G7 ✅ deployed

## Passing checks (run 2026-10-28)
lint ✅ · typecheck ✅ · unit + integration 112 ✅ · build ✅ · E2E 45 (37 pass, 8 desktop-only skips on phone projects) ✅

## Blockers (owner)
1. ✅ Public repo: https://github.com/415geek/restaurant-iq-2 (MIT, created 2026-10-28).
2. ✅ Production: https://restaurant-iq-2.vercel.app (Vercel hobby team `c8geeks-projects`, deployed 2026-10-28; full Playwright suite green against prod: 37 pass, 8 desktop-only skips). Deploy again with `bunx vercel deploy --prod --scope c8geeks-projects`. Env vars with env vars (Supabase URL/anon/service role, `QLOO_API_KEY`, `QLOO_BASE_URL`, `CRON_SECRET`, `SERPAPI_API_KEY`). `vercel.json` registers the daily cron.
5. `ANTHROPIC_API_KEY` is empty: AI column mapping and PDF/photo reading are disabled (shown with a reason). Rules handle the sample files.
4. SerpApi free plan for this key is exhausted until 2026-11-04 (250/250 used). Web events show "quota used up" until then.
3. Supabase Auth (owner, dashboard): add `https://restaurant-iq-2.vercel.app/**` to Authentication → URL Configuration → Redirect URLs (the demo needs no login).

## Product pivot (2026-10-27)
Positioning moved from "decision report" to **TastePass: Qloo affinity → owner-approved offer → real redemption signal**. Reason: comparable entries (TasteTest, Carte Locale, Overlap, Encore) stop at recommendations; none closes the loop to a measured outcome. Plan: `~/.claude/plans/swirling-dancing-acorn.md`.

## Execution positioning + experiment review (2026-10-28 PM)
Owner chose B (per-pass POS experiment review) and the execution theme (AWS article: "AI that actually executes, with confirm and rollback") before Ring.
- `src/lib/business/experiment.ts`: pass window vs the same local weekdays/hours 1–4 weeks earlier (DST-safe shift), clipped to the last sales row; needs ≥2 prior weeks; statuses not_started / awaiting_sales / short_history / ready; verdict above / within / below the prior range. Unit tests `tests/unit/experiment.test.ts`.
- `ExperimentReviewCard` on `/r/[id]/passes/[cid]`. Demo worked example: `scripts/seed-demo-review.ts` seeds one ended pass (Oct 19–25, inside the synthetic sales) tagged `created_by = seed:demo-review`; `clean-demo-passes.ts` keeps it. Result on synthetic data: below all 4 prior weeks (orders −8%), shown as such.
- `HoldButton` (pointer + keyboard) for Approve; E2E checks a quick click does nothing.
- Ring (owner has a developer account; camera at the restaurant entrance): credentials in `.env.local` only (`RING_CLIENT_ID`, `RING_CLIENT_SECRET`, `RING_HMAC_KEY`). Planned minimal slice after this: Ring-initiated account linking (Token Exchange `/api/ring/token`, Account Link `/ring/link`, homepage `/ring`, webhook `/api/ring/webhook`), `motion_detected` human events only, timestamps and type only, no images. Owner must not click "link" in the Ring app until those routes are deployed.

## Evidence
`docs/tests/TEST_REPORT.md`, `docs/evidence/screenshots/*.png`, `docs/security/REVIEW.md`, `docs/dev-memory/SETUP.md`

## Next three actions
1. Ring minimal slice (see above), behind a feature flag; HMAC-verified webhook; event-only signal in the Prove view.
2. Regenerate screenshots (`scripts/screenshots.ts`) incl. experiment review; README hero image.
3. Final clean-browser judge walk in en/zh/es; submit by 17:00 PT Oct 30.

## 2026-10-28 (night) — Ring entrance camera, events only (behind `RING_ENABLED`)
- Migration 0010: `ring_connections` (service role only, tokens AES-GCM encrypted) and `ring_events` (time + hashed device ref; RLS read like other restaurant data).
- Routes: `/api/ring/token` (Token Exchange URL), `/ring/link` + `/api/ring/link` (Account Link URL; owner passcode + nonce match, then app-integrations POST/PATCH), `/api/ring/webhook` (X-Signature HMAC over raw body; keeps only `motion_detected` with `sub_type=human`; idempotent on `meta.request_id`; `app_integration_removed` revokes and drops tokens), `/ring` (App Homepage URL).
- Pass page shows an "Entrance activity · Ring" card only when a camera is linked or has sent events: person events during the pass, same hours a week earlier (only if the camera was linked by then), last 7 days. Labeled "not a guest count".
- Checks: 11 unit tests (`tests/unit/ring.test.ts`), `scripts/ring-selftest.ts` (8 end-to-end checks against a running server, cleans up).
- Production needs Vercel env: RING_CLIENT_ID, RING_CLIENT_SECRET, RING_HMAC_KEY, RING_ENABLED=1, RING_LINK_PASSCODE.

## 2026-10-30 — TasteFront (branch `tastefront`): one storefront per neighborhood
- Migration 0011: `front_brands`, `front_guardrails`, `front_stores`, `front_menus`, `front_menu_items`, `front_runs`, `front_versions`, `front_moves`, `front_holdouts`; `private.can_read_org`; RLS read-only for members/demo, writes via service role.
- `src/lib/front/`: `types.ts` (contracts), `qloo.ts` (neighborhood profile from a location signal, crowd/city place sets, heatmap per store, deterministic rank, rival contrast; every call recorded as names+scores for verification), `lift.ts` (crowd-vs-city contrast, most-specific terms, low_count), `menu/` (CSV/text/URL/photo parsing, Qloo tag mapping with ambiguity), `moves.ts` (zod proposal schema, guardrails + caps, citation verifier, deterministic apply, deterministic planner when no model), `agent.ts` (Anthropic tool runner; final answer = one `propose_moves` call; baseline variant = Qloo tools stubbed), `holdout.ts` (alternate weeks / seeded store split by heat terciles), `settle.ts` (dollars vs control, prior range, fluke rate, waiting states), `db.ts`, `settlement.ts`, `replays.ts`.
- Routes: `POST /api/front/stores/[id]/run` (NDJSON stream, 6/hour per visitor), `/api/front/versions/[id]` (publish | rollback), `/api/front/stores/[id]/holdout`, `/api/front/brands/[id]/holdout`, `/api/front/brands/[id]/guardrails`, `/api/front/stores/[id]/menu` (ingest + tag mapping), `/api/mcp` (storefront_profile, storefront_moves).
- Surfaces: `/m/[slug]` (Qloo on/off switch, evidence popovers), `/front` (owner card: moves, hold-to-approve, roll back, run console, settlement), `/front/fleet` (heat map, guardrails, approval queue, store split). Home page replays three recorded runs.
- Fixture tenant: `scripts/seed-front.ts` (Chuan Lane 1 store · Cloud Nine Tea 5 · Bamboo Bowl 40, synthetic menus on real neighborhoods; demo holdout Oct 12–18 vs Oct 19–25 inside the sample sales). `scripts/front-run.ts` / `front-run-all.sh` run the agent from the CLI (`--conditions=react-server`).
- Qloo findings (live, 2026-10-30): tag affinities with a location signal saturate near 1.0 (Californian 1, Tourists 0.99997), so lift is the primary ranking signal; `signal.location` + 1.5 km radius returns ~34 crowd places vs ~109 city places for San Bruno.
- Open: `ANTHROPIC_API_KEY` still empty → deterministic planner, no copy rewrite; replays are recorded deterministic-planner runs until the key is set and runs are re-recorded.
- Verified 2026-10-30 02:30 PDT: lint 0 errors · typecheck · 182 unit/front tests · build · Playwright 52 passed / 8 skipped against production (https://restaurant-iq-2.vercel.app) incl. `tests/e2e/front.spec.ts` (menu switch with zero network calls, owner card, fleet, home replays). Commit `cb06f4f` merged to main. Published storefronts: chuan-lane v5, cloud-nine-daly-city v1, bamboo-bowl-01 v1; store-split holdouts seeded for both brands (seed 20261030).
- Qloo daily cap: one 46-store batch used ~430 live calls; default raised to 1500 (`guard.ts`), local env 2000. Vercel `QLOO_DAILY_CALL_CAP` must be raised by the owner (secret-store writes are blocked for the agent).

### 2026-10-30 (evening) — P0 UX pass from the "new-immigrant owner, limited English" review (commit `8110c2c`)
- Moves carry a structured `why` (term + lift or affinity + lowCount); the owner card and the diner popover phrase it through i18n templates in en/zh/es (e.g. zh "设为主推：附近的人点「fried rice」这类菜，是全市平均的 1.8 倍。"). Model-written moves without `why` still show the stored English rationale.
- Lift terms: a lone word counts only when it is a whole Qloo tag name (fragments such as "cooked", "kung", "chongqing" are gone); low-count evidence can reorder but never feature (caveat "Nothing featured…" when nothing is strong enough).
- Public menu: "changed" badge only for name/description/featured (position-only changes stay quiet); switch reads "Neighborhood menu / Original menu" (zh 街区版/原版); TastePass button appears only when the offer's dish is on this menu, labeled with dish + price.
- Owner card: menu-language names first, localized risk, "v{n} is live, run again for a new draft" hint, undo wording instead of rollback. Settlement: net-sales line, featured-units line or why they are not counted, fluke line, "one week only", localized control label. Fleet: size class, map failure (detail in `title`) and moves count localized. Step bar fits 390 px.
- Re-ran and published chuan-lane (v7), the five cloud-nine stores (v2) and bamboo-bowl-01 (v2) so stored moves carry `why`. Checks: lint 0 errors, typecheck, 185 unit tests, build; production Playwright run recorded below.

## 2026-10-30 (late afternoon) — Radar: proactive home, social copy, 3-step store setup
Owner brief: owners only see the inside of the restaurant; the product must watch the outside (events, holidays, school calendar), say who the crowd is (Qloo), pair it with an offer, publish coupon + social post, redeem by phone, and learn.
- `src/lib/business/radar.ts` (pure, 12 unit tests): `outlookFor` (per-moment outlook rules), `schoolBreakAhead` (labeled Bay Area heuristic), `weeklyPulse` (last 7 days vs prior 4 same-weekday windows, ignores refunds), `buildPlays` (moment × costed hypothesis by theme), `outsideCauses`.
- `src/lib/business/social.ts` (pure, 5 tests): per-platform, per-language templates (Instagram/Facebook/Nextdoor en, 小红书/WeChat zh, es available); numbers, dates and the claim URL are read from the pass; Facebook sharer link; hashtags from cuisine/neighborhood.
- Home `/r/[id]` is now **Radar**: tiles (moments nearby, sales pulse, school calendar), outside causes, plays (`RadarPlays`, with "Who does this draw? Ask Qloo" via `/api/moments/fit`), six-agent strip, learning card (ended passes × `reviewExperiment`), taste chips, profile with POS note. Nav/steps renamed Snapshot → Radar.
- Pass page: `SocialPostCard` under the QR/redeem row (non-draft only). Onboarding: three steps; `POST /api/restaurants/menu-from-url` (signed-in, rate-limited, SSRF-guarded via `front/menu/fetch.ts`) fills the menu textarea from a public menu page.
- Landing copy repositioned (Radar first); e2e judge-flow expectations updated. README / JUDGE_GUIDE / SUBMISSION lead with Radar; TasteFront sections kept.
- Not done: POS OAuth (interface only), photo menu import in onboarding (needs `ANTHROPIC_API_KEY`), LLM rephrasing of social copy (deterministic templates only).

## 2026-10-30 (16:30 PT) — phone simplification
Four-tab bottom bar (Radar · Moments · Ideas · Pass) + "More" sheet (signals, sales, action board, memory, sign-in, language). Radar on phones: one 3-column summary strip, two outside causes then "more", two plays then "more", agents collapsed to "6/6 steps done", signals + profile behind one disclosure, full-width Launch button. Step bar hidden on phones for the home. Production Playwright mobile-375/390: 34 passed, 8 skipped.
