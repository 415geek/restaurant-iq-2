# Devpost submission — Restaurant IQ (Radar · TasteFront · TastePass)

**Title:** Restaurant IQ — Radar, TasteFront & TastePass *(owner decision: keep "TasteFront by Restaurant IQ" if the Devpost draft already uses it)*
**Tagline (≤120 chars):** See what is coming to your block, act before the slow week does, prove it in dollars. Qloo tells you who the crowd is.
**Live demo URL:** https://restaurant-iq-2.vercel.app (demo radar https://restaurant-iq-2.vercel.app/demo · customer menu https://restaurant-iq-2.vercel.app/m/chuan-lane-san-bruno · owner card https://restaurant-iq-2.vercel.app/front · HQ https://restaurant-iq-2.vercel.app/front/fleet)
**Public repository:** https://github.com/415geek/restaurant-iq-2 (MIT license visible in About)
**Built with:** Qloo API (insights: tags, demographics, place sets, heatmap; tags search), Claude via the Anthropic SDK tool runner, Next.js 16, Supabase (Postgres + RLS), Vercel, TypeScript, Tailwind, Playwright
**Deadline:** Oct 30, 2026, 11:45 pm EDT

## Project description (paste into Devpost)

### Inspiration
I have sold restaurant POS to Asian restaurants across the Bay Area for years. The owners I know spend every hour inside the four walls. They do not know the street fair is two blocks away on Saturday, that the university empties next week, or that the music festival in the park lets out at 10 pm; they close at 9 as usual and the revenue walks past. When a week goes quiet they wait, or discount on a hunch, and the discount does nothing, because the cause was never inside the kitchen. And the dishes they are proudest of are written for the customers they wish they had, not the neighbors they actually have.

### What it does
Restaurant IQ is a proactive agent for independent restaurants. It watches the outside of the restaurant and turns what it finds into one approved action at a time.
- **Radar (home):** holidays, the school calendar, street and community permits, web events and the owner's own sales in a 21-day window. Each moment gets a plain-language outlook; the week gets its outside causes named with direction; Qloo's demographics say who that crowd is and whether it looks like the store's regulars.
- **Plays:** each moment is paired with the idea six bounded agents already costed (contribution per order, break-even); money-losing offers are blocked with a reason.
- **Launch, with the owner's OK:** press and hold, and the play becomes a TastePass: public claim page, QR, and social copy per platform and language (Instagram, Facebook, 小红书, WeChat, Nextdoor). Redemption is a phone at the counter.
- **Prove and learn:** live claims and redemptions, a review against the same hours in the prior 4 weeks of sales, and a Business Brain that keeps every step as an immutable event and feeds the next recommendation.
- **TasteFront:** the same Qloo signals rewrite the public menu per neighborhood (order, names, featured items), versioned and switchable, with lift settled against a holdout; chains and franchises are first-class tenants.
- **Store setup:** store → menu (paste a menu or delivery-app link and import, or type it) → optional costs. POS connectors are an interface, not yet connected.

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
