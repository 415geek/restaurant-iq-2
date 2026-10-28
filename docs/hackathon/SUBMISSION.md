# Devpost submission — TastePass by Restaurant IQ

**Live demo URL:** PENDING (recorded here the moment the Vercel deployment is verified)
**Public repository:** https://github.com/415geek/restaurant-iq-2 (MIT license visible in About)
**Deadline:** Oct 30, 2026, 11:45 pm EDT

## Project des## Project description (paste into Devpost)

**TastePass — from a Qloo cultural affinity to a real restaurant redemption.**

AI can invent a thousand marketing ideas. An independent restaurant owner, with no growth manager and a slow Tuesday afternoon, needs one idea that reaches a real person, fits the kitchen, and can be measured. TastePass by Restaurant IQ does that loop end to end.

**1. Read the taste.** A bounded six-stage workflow (deterministic steps with tool calls, budgets and an evaluator gate) (Intake → Evidence → Opportunity → Finance → Execution → Evaluator) calls the Qloo API server-side. `/v2/tags` resolves "Taiwanese / Chinese noodles" to restaurant genre tags. `/v2/insights` returns the place attributes this audience over-indexes on (split by tag type: genre, ambience, customer identity, dishes), nearby places with `feature.explainability`, cross-domain brands, podcasts, artists and shows, and age/gender skew.

**2. Pick a cultural anchor.** The owner types an artist, film, show, brand or podcast their guests love. Qloo `/search` resolves it, and `/v2/insights` with `signal.interests.entities` returns the city's restaurants whose audience overlaps that anchor's fans, with explainability, plus the fans' demographics. That turns "people who like X" into a concrete, local audience hook.

**3. Pick one idea, costed.** A deterministic scorer ranks a cuisine-agnostic catalog on taste fit, operational fit, feasibility, unit economics and evidence quality. Constraints ("no liquor license", "2 cooks on weekdays") reject ideas with reasons. A With/Without Qloo toggle ranks the same ideas twice and names the exact Qloo signal that moved each one.

**4. Activate a TastePass.** The owner edits offer, price, food cost, fees, fixed spend, cap and dates. Profit per redemption and break-even recompute as arithmetic. A NO-GO (zero or negative contribution) cannot be approved. Approval creates a public pass page and QR code, an approval record, a launch task and a memory event.

**5. Prove it.** A guest opens the pass on a phone, no account and no personal data, and claims a one-time code. The merchant redeems it at the counter; a Postgres function makes redemption atomic and idempotent, so a code counts once. The proof dashboard updates live: views, claims, redemptions, conversion and optional verified sales, next to what this does not prove.

**What is Qloo-powered:** tag resolution, typed tag affinities, local place affinities with explainability, cross-domain affinities, demographics, entity search for anchors, and anchor-to-place insights. Remove Qloo and the product has no audience, no anchor and no reason for the offer.

**Honesty by design:** affinity is a relation, never demand. A redemption is a visit, not proof of extra sales. Live failures fail loud; nothing is substituted. Economics are arithmetic; no LLM computes totals. The demo restaurant is synthetic and its passes are sandbox.

g the submission period

Greenfield repository created 2026-10-23 (first commit `4c1a179`). All Qloo integration, agent logic, UI and tests were written between 2026-10-23 and submission. No prior code reused.

## Testing instructions for judges

See `JUDGE_GUIDE.md`. No account required for the demo workspace.
