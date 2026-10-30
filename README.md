# TasteFront by Restaurant IQ

> Every storefront tuned to its neighborhood on Qloo's taste graph, published live, proven in dollars.

TasteFront is an agent fleet that rewrites each restaurant's money-making surface, the public online menu, to match what its neighborhood leans toward on Qloo's taste graph, publishes the change as a versioned **Storefront**, and proves the lift against a holdout in dollars from the POS. Every other restaurant agent hands the owner a report. TasteFront edits the menu the customer is about to order from. One product serves a single mom-and-pop store, a 5-store chain and a 40-store franchise; the only differences are who approves, how many stores, and how strict the HQ guardrails are.

- **Live demo (no account):** https://restaurant-iq-2.vercel.app · customer menu `/m/chuan-lane-san-bruno` · owner card `/front` · HQ fleet `/front/fleet`
- **Public repository:** https://github.com/415geek/restaurant-iq-2 · MIT · built during the Qloo Agentic Hackathon 2026 (first commit 2026-10-23, TasteFront branch merged 2026-10-30)
- **TastePass** (the proof layer, submitted earlier in the same repo): owner-approved pass → public claim → merchant redemption → experiment review. TasteFront is the headline; TastePass is its second layer of evidence.

## Judge in 60 seconds

1. **Home page → three replay cards** (a 1-store Sichuan restaurant in San Bruno, a 5-store boba chain, a 40-store Asian fast-casual brand). Click one: the agent log plays a **recorded real run** (live Qloo calls) while the menu on the right turns from "as printed" into the published storefront. Every line names the Qloo tag or lift term behind it.
2. **Open the customer menu** (`/m/<store>`). Flip **Qloo on / off** at the top: the order, featured items and descriptions change with no network call. Tap a changed item's badge: the evidence popover shows the tag or term, the score, the neighborhood and **✓ verified / ⚠ unverified** against the stored Qloo response.
3. **Owner card** (`/front`): "N moves this week", each with before → after and its citation. **Press and hold Approve** to publish (a quick click does nothing). **Roll back** undoes it; both are immutable events.
4. **Settlement card** on the same page: "Change week vs control week: net sales, orders, featured-item units, prior-4-week range, fluke rate", computed from uploaded sales only. The demo store is linked to synthetic sample sales and says so; a store with no sales shows **Waiting for sales data**, never an estimate.
5. **HQ fleet** (`/front/fleet?brand=bamboo-bowl`): 40 stores colored by Qloo heat for the selected feature item, the guardrails panel (renamable items, price band, banned terms, tone), the approval queue, and the store split: "N changed, M held out".
6. **Run it yourself**: on the owner card press **Run agent**. The log streams live (rate-limited, ~10 s with Qloo on and the deterministic planner; ~1–2 min with the language model configured).

## How this maps to the judging criteria

| Criterion | Where to look |
|---|---|
| Technological implementation | `src/lib/front/qloo.ts` (every Qloo workflow with provenance), `src/lib/front/lift.ts` (crowd-vs-city contrast), `src/lib/front/agent.ts` (tool runner + verifier), `src/lib/front/moves.ts` (guardrails, citation verifier, deterministic application), `supabase/migrations/0011_front_core.sql` (RLS) |
| Design | `/m/[slug]`, `/front`, `/front/fleet`, `DESIGN.md`; three languages (`src/i18n`) |
| Potential impact | the settlement card and `src/lib/front/settle.ts`: lift in dollars against a holdout, or an explicit "waiting"; the owner never opens a dashboard |
| Quality of the idea | the public menu page with the Qloo on/off switch: the only entry whose output is the page the customer orders from, and the only one built for chains |

## How TasteFront uses Qloo

All calls are server-side against `https://hackathon.api.qloo.com` with `X-Api-Key`, cached 6 h, provenance stored (endpoint, redacted params, time, cache hit, mode). No raw payloads are stored; each run keeps only the names and scores it needs for verification (`front_runs.calls`).

| Question | Call | Used for |
|---|---|---|
| Which Qloo tag is this dish? | `GET /v2/tags` `filter.query=<item>` `filter.parents.types=urn:entity:place` | `map_menu_tags`: place-scoped tags preferred (specialty_dish, genre, cuisine, dietary). Same name under several ids = **ambiguous**, kept out of scoring until resolved. |
| What does this neighborhood lean toward? | `GET /v2/insights` `filter.type=urn:tag` + `signal.location=POINT(lng lat)` + `signal.location.radius=1500` + `filter.tag.types` (specialty_dish / genre / ambience / customer_identity) | `neighborhood_profile`: a location signal, so a small restaurant that is thin in the graph still gets a profile. |
| Who is around here? | `GET /v2/insights` `filter.type=urn:demographics` `signal.interests.tags=<top tags>` | copy tone only; never individual inference |
| What is loved here but ordinary citywide? | two `GET /v2/insights` `filter.type=urn:entity:place` `filter.tags=urn:tag:genre:place:restaurant` `filter.location.query=<city>` (3 × 50), one with `signal.location` = the store, one without | `dish_lift`: crowd-vs-city contrast (share of crowd menus mentioning a term ÷ share of city menus, add-one smoothed, geometric mean per item, `low_count` under 5 menus). Qloo affinities saturate near 1.0, so this contrast is the primary ranking signal. |
| Which store suits which dish? | `GET /v2/insights` `filter.type=urn:heatmap` `filter.location=POINT` `filter.location.radius=<brand territory>` `signal.interests.tags=<item tags>` | `store_heat`: nearest cell within 1.5 km per store, z-scored across the brand; strata for the store split |
| What does the nearest rival carry that we do not? | the crowd place set's tags | `compare_rival` (computed from returned tags; no extra call) |

Real numbers from a recorded run (San Bruno, live): 34 crowd menus vs 109 city menus; "fried rice" ×1.8, "pork belly" ×1.57 (low count); neighborhood tags Californian 1.0, Tourists 0.99997, Lively 0.99992.

## Three layers of evidence

| Layer | Answers | How |
|---|---|---|
| L1 Qloo on/off | "a model could reorder a menu without Qloo" | same prompt, same guardrails, same menu, Qloo inputs replaced by a neutral prior; both versions stored; the public page flips between them. A rank change is attributable to Qloo inputs, not proof of a better outcome. |
| L2 TastePass | "would a customer act on it?" | a `pass` move hands off to TastePass: one-time claim codes, merchant-verified redemptions, 3-second proof dashboard |
| L3 POS holdout | "did it make money?" | single store: alternate weeks (change week, control week, same local weekday-hours, DST-safe); brand: random half of stores change, half hold, stratified by heat with a persisted seed. `settle_week` reports net-sales lift in dollars, orders, featured-item units, the prior-4-week range and the fluke rate, or **waiting for sales data**. |

## Request-to-result (redacted)

```
GET /v2/insights?filter.type=urn:tag&filter.parents.types=urn:entity:place&signal.location=POINT(-122.4111 37.6305)&signal.location.radius=1500&filter.tag.types=urn:tag:specialty_dish:place&take=12
→ tags: [{ name: "Californian", affinity: 1 }, { name: "Tourists", affinity: 0.999966 }, …]          # stored as facts c1
GET /v2/insights?filter.type=urn:entity:place&filter.tags=urn:tag:genre:place:restaurant&filter.location.query=San Bruno, CA&signal.location=POINT(…)&take=50&page=1
→ 34 places with menu tags                                                                            # c3 (crowd)
GET /v2/insights?… (same, no signal) → 109 places                                                     # c4 (city)
lift.ts → { "fried rice": 1.8, "pork belly": 1.57 (low count), … }                                    # c5 (computed, cites c3/c4)
propose_moves → feature Egg Fried Rice, evidence [{ callId: "c5", name: "fried rice", score: 1.8 }]  # verifier: ✓
```

## What the owner, HQ and the customer get

- **Owner (1 store):** one card: "N moves this week", press-and-hold approve, roll back, the settlement number. The owner never opens a dashboard.
- **HQ (chains):** guardrails (renamable items, price band, banned terms, tone), a per-store approval queue, "N changed, M held out", a heat map per feature item. Franchisees get the owner card scoped to their store.
- **Customer:** a mobile menu with featured items first and no tracking (no analytics, no cookies except the locale cookie, no PII).

## How the agent works

`src/lib/front/agent.ts`: deterministic code gathers and scores (resolve_store → neighborhood_profile → dish_lift → rank_features → compare_rival); the model (Anthropic SDK tool runner, `claude-opus-5-5`, adaptive thinking) reads those results through tools and answers with exactly one `propose_moves` call (zod-validated: ≤7 moves; reorder / rename / feature 1–3 / promote ≤1 / pass ≤1; each move cites `{callId, name, score}`). Then `applyGuardrails` enforces HQ rules and caps, `verifyEvidence` checks every citation against the run's stored facts (name match, score within tolerance) and marks ✓/⚠, and `applyMoves` builds the version. Without `ANTHROPIC_API_KEY` the deterministic planner features and reorders by lift and never writes copy (the run says so in its caveats). Live runs are rate-limited per visitor (6/hour) and Qloo calls are capped per day.

## Qloo data handling

Key server-only. Responses cached 6 h in Postgres (`provider_cache`); stored per run as names + scores only. Signals sent to Qloo: the store's lat/lng, the city name and tag ids. Never a customer, never a sales row.

## Known limitations: what the results do not establish

- Affinity and lift describe what people who like these kinds of places lean toward, in aggregate. They are not how many portions a dish will sell; the one-week version exists to find out.
- Qloo's crowd is not the people at the counter.
- The crowd-vs-city lift is measured with Qloo's own menu tags; it says whether a dish follows this crowd's Qloo signal, not demand. Under 5 menus it is `low_count`.
- Settlement needs sales that cover the window. The demo settles on synthetic sales and says "Sample". L3 is real only with a POS export.
- Coverage varies by city; a city name can resolve widely.
- The verifier checks cited names and scores, not the reasoning the model built on them.
- Replays are recorded runs; a live run takes seconds to minutes and is capped per day.

## Business case

Who pays: independent restaurants and 2–50-store chains, per store per month. Price assumption US$49 (single store) to US$199 (HQ guardrails + store holdouts). Cost per version: roughly US$0.3–0.5 of model time plus 20–40 Qloo calls. Channel: POS app marketplaces and our own POS customers (the founder has sold restaurant POS to Asian restaurants across North America for 17 years; the first 20 validation stores come from that base). Why Qloo: the menu is the highest-frequency surface in the trade, and a storefront tuned per neighborhood is a Qloo query per store per week.

## Use it from any agent (MCP)

`POST https://restaurant-iq-2.vercel.app/api/mcp` (Streamable HTTP, JSON-RPC, read-only, demo stores). Tools: `storefront_profile(store)` and `storefront_moves(store)`.

```json
{ "mcpServers": { "tastefront": { "url": "https://restaurant-iq-2.vercel.app/api/mcp" } } }
```

## Run it locally

```bash
bun install
cp .env.example .env.local        # Supabase keys required; QLOO_API_KEY and ANTHROPIC_API_KEY optional
bun run dev                       # http://localhost:3000
```

- **Fixture mode** (no keys): Qloo returns labeled synthetic fixtures ("Sample dataset — illustrative, not live Qloo data"), the planner is deterministic.
- **Live Qloo, deterministic planner** (`QLOO_API_KEY` only): real neighborhood profiles and lift; order and featured items change; copy stays as printed.
- **Live** (`QLOO_API_KEY` + `ANTHROPIC_API_KEY`): the model chooses moves and writes copy; every citation verified.

Database: apply `supabase/migrations/0001` → `0011` in order, then `bun --env-file=.env.local scripts/seed-front.ts` (46 fixture stores, 3 brands, demo holdout). Run one store: `bun --conditions=react-server --env-file=.env.local scripts/front-run.ts chuan-lane-san-bruno both --publish`. Whole brand: `sh scripts/front-run-all.sh cloud-nine qloo`.

## Checks

```bash
bun run lint && bun run typecheck && bun run test && bun run build
bunx playwright test tests/e2e/front.spec.ts            # dev server starts automatically
```

Unit tests cover lift (fixtures of 145 vs 139 places), guardrails and the verifier, holdout stratification (seeded, reproducible), settlement (DST-safe windows, waiting/short-history states), menu parsing and tag disambiguation, plus everything TastePass had (economics, token state machine, RLS).

## Stack · Who built it · License

Next.js 16 · TypeScript · Tailwind 4 · Supabase (Postgres + RLS) · Anthropic SDK (tool runner) · Qloo API · zod · vitest · Playwright · bun · Vercel. Built by a restaurant-SaaS BD professional with Claude Code during the hackathon window. MIT.

---

### TastePass (the proof layer)

Still in the app under `/r/<restaurant>`: Qloo signals and cultural anchors, local Moments, sales uploads and the Business Brain, costed ideas with a With/Without Qloo comparison, press-and-hold approval of a TastePass, public claim page, atomic merchant redemption, the 3-second proof dashboard and the experiment review against the prior 4 weeks. `docs/hackathon/JUDGE_GUIDE.md` walks both products.
