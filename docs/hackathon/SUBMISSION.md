# Devpost submission — TasteFront by Restaurant IQ

**Title:** TasteFront by Restaurant IQ
**Tagline (≤120 chars):** Every storefront tuned to its neighborhood on Qloo's taste graph, published live, proven in dollars.
**Live demo URL:** https://restaurant-iq-2.vercel.app (customer menu https://restaurant-iq-2.vercel.app/m/chuan-lane-san-bruno · owner card https://restaurant-iq-2.vercel.app/front · HQ https://restaurant-iq-2.vercel.app/front/fleet)
**Public repository:** https://github.com/415geek/restaurant-iq-2 (MIT license visible in About)
**Built with:** Qloo API (insights: tags, demographics, place sets, heatmap; tags search), Claude via the Anthropic SDK tool runner, Next.js 16, Supabase (Postgres + RLS), Vercel, TypeScript, Tailwind, Playwright
**Deadline:** Oct 30, 2026, 11:45 pm EDT

## Project description (paste into Devpost)

### Inspiration
I have sold restaurant POS to Asian restaurants across North America for years. Owners know their costs to the cent and still write their menus for the customers they wish they had, not the neighbors they actually have. Chains have the opposite problem: one menu, forty neighborhoods. Every AI tool they are offered hands them a report. Nobody edits the page the customer orders from.

### What it does
TasteFront is an agent fleet that rewrites a restaurant's public menu for its neighborhood using Qloo's taste graph, publishes the change as a versioned storefront, and proves the lift against a holdout in dollars.
- **Reads the neighborhood:** Qloo tag affinities around the store (dishes, cuisines, ambience, customer identity) from a location signal, demographics, and a crowd-vs-city contrast that separates what this block leans toward from what is popular everywhere.
- **Rewrites the storefront:** reorders, renames and describes items in the owner's language plus English, picks 1–3 featured items, and proposes at most one paid promotion with a computed contribution margin and one TastePass. Every move cites the Qloo tag or lift term and score behind it, and the server verifies each citation against the run's own Qloo responses (✓ / ⚠).
- **Publishes and proves:** the owner approves with one press-and-hold; the public menu page flips between "Qloo on" and "Qloo off"; a TastePass on the featured item counts real claims and merchant-verified redemptions; a holdout (alternate weeks for one store, a random, heat-stratified half of stores for a chain) settles net-sales lift from uploaded or POS sales, with the prior-4-week range and the fluke rate stated, or says "waiting for sales data".
- **Scales:** HQ sets guardrails (renamable items, price band, banned terms, tone); each store runs its own agent; franchisees only receive a card.

### How we built it
Next.js 16 + Supabase on Vercel, in the same repo as TastePass (our earlier proof layer). Deterministic TypeScript owns every number: the neighborhood profile and place sets come from `/v2/insights` with location signals, the crowd-vs-city lift is computed in `lift.ts` (add-one smoothed share ratios, geometric mean per item, low-count flags), store heat from the heatmap endpoint is z-scored across a brand, and holdouts are seeded and reproducible. Claude, through the Anthropic SDK tool runner, reads those results as tools (`resolve_store`, `parse_menu`, `neighborhood_profile`, `dish_lift`, `rank_features`, `compare_rival`) and answers with one schema-validated `propose_moves` call. Guardrails, the citation verifier and the version builder run after it. The same prompt with every Qloo tool replaced by a neutral prior produces the "Qloo off" baseline. Every table has RLS; the demo tenant is world-readable and all writes go through rate-limited server routes.

### Challenges we ran into
Small restaurants are thin in the graph, so the neighborhood profile is built from location signals rather than the restaurant entity. Qloo tag affinity saturates near 1.0 for any audience (Californian 1.0, Tourists 0.99997, Lively 0.99992 around our San Bruno store), so raw affinity cannot rank dishes; we score with the crowd-vs-city contrast instead and use affinity only as a tie-break. Several tags share a name; ambiguous tags are excluded, not guessed. Menu item names are mostly multi-word, so lift terms keep only the most specific term ("fried rice", not "rice").

### Accomplishments
A real menu, rewritten by Qloo signals, published, switchable, verified line by line, and settled against a holdout, in three languages, with chains and franchises as first-class tenants. The run that drafts a storefront takes about ten seconds with Qloo live.

### What we learned
The difference between a demo and a product is whether the owner has to open anything. One card, one press, one number.

### What's next
Menu publishing through POS menu APIs, delivery-listing surfaces, and the first twenty paying stores from our existing POS customer base.

## Qloo submission guide (six items)

1. **Problem statement:** owners write menus for the customers they wish they had; chains ship one menu to forty neighborhoods. See README "What it does".
2. **Workflows used and why:** README "How TasteFront uses Qloo" (tags search for item mapping, tag insights with a location signal for the neighborhood profile, demographics for tone, two place-set insights for the crowd-vs-city contrast, heatmap for store heat).
3. **Request-to-result, redacted:** README "Request-to-result".
4. **Demo without credentials or personal data:** the live URL; demo tenant is world-readable; no account, no PII anywhere on `/m/[slug]`.
5. **Reproducible in a clean environment:** README "Run it locally" (fixture mode with no keys; live mode with keys; migrations 0001–0011 and `scripts/seed-front.ts`).
6. **Known limitations:** README "Known limitations: what the results do not establish".

## Built during the submission period

Greenfield repository created 2026-10-23 (first commit `4c1a179`). TastePass shipped 2026-10-27/28; TasteFront (branch `tastefront`, `src/lib/front`, `src/app/(front)`, migration 0011) was built 2026-10-30. No prior code reused.

## Testing instructions for judges

See `JUDGE_GUIDE.md`. No account required.
