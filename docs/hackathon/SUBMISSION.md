# Devpost submission — TastePass by Restaurant IQ

**Live demo URL:** https://restaurant-iq-2.vercel.app (demo workspace: https://restaurant-iq-2.vercel.app/r/00000000-0000-4000-8000-000000000101)
**Public repository:** https://github.com/415geek/restaurant-iq-2 (MIT license visible in About)
**Deadline:** Oct 30, 2026, 11:45 pm EDT

## Project description (paste into Devpost)

**TastePass — restaurant AI that executes, with taste. From a Qloo cultural affinity to a real redemption, and an honest review of whether it worked.**

Most restaurant AI stops at a recommendation. An independent owner with no growth manager and a slow Tuesday afternoon does not need another dashboard of ideas. They need one idea that reaches a real person, fits the kitchen, goes live with their OK, can be stopped at any time, and gets measured afterwards. TastePass runs that loop end to end: **Signals → Recommend → Execute → Prove**.

**1. Signals.** A bounded six-stage workflow (Intake → Evidence → Opportunity → Finance → Execution → Evaluator; deterministic steps with tool calls, budgets and an evaluator gate) calls the Qloo API server-side. `/v2/tags` resolves "Taiwanese / Chinese noodles" to restaurant genre tags. `/v2/insights` returns the place attributes this audience over-indexes on (split by tag type: genre, ambience, customer identity, dishes), nearby places with `feature.explainability`, cross-domain brands, podcasts, artists and shows, and age/gender skew. A **cultural anchor** (an artist, film, show, brand or podcast the owner's guests love) is resolved with `/search`, and `/v2/insights` with `signal.interests.entities` returns the city's restaurants whose audience overlaps that anchor's fans. **Moments** adds hyperlocal events (street-closure permits, community events, holidays) and asks Qloo who each event's theme draws. **Sales data** adds the owner's own POS and delivery exports, unified into one table.

**2. Recommend.** A deterministic scorer ranks a cuisine-agnostic catalog on taste fit, operational fit, feasibility, unit economics and evidence quality. Constraints ("no liquor license", "2 cooks on weekdays") reject ideas with reasons. A With/Without Qloo toggle is a controlled comparison that names the exact Qloo signal that moved each idea.

**3. Execute, with the owner's OK.** The owner edits offer, price, food cost, fees, fixed spend, cap and dates; profit per redemption, break-even and worst-case loss recompute as arithmetic. A NO-GO (zero or negative contribution) cannot be approved. Approval is **press-and-hold**, so nothing goes live by accident. It creates a public pass page and QR code, an approval record, a launch task and a memory event. **Stop TastePass** halts new claims and redemptions at once and keeps the history.

**4. Prove.** A guest opens the pass on a phone, no account and no personal data, and claims a one-time code. The merchant redeems it at the counter; a Postgres function makes redemption atomic and idempotent, so a code counts once. The proof dashboard updates live. Then the **experiment review** compares the pass window with the same weekdays and hours in the 4 weeks before it, from the owner's uploaded sales: orders, net sales and units of the pass item, the prior range, and a plain verdict (above, within or below the normal range), with the chance of a fluke stated. On the demo, the worked example came out *below* the prior weeks, and the product says so: "Do not repeat it as is."

**What is Qloo-powered:** tag resolution, typed tag affinities, local place affinities with explainability, cross-domain affinities, demographics, entity search for anchors, and anchor-to-place insights. Remove Qloo and the product has no audience, no anchor and no reason for the offer.

**Honesty by design:** affinity is a relation, never demand. A redemption is a visit, not proof of extra sales. The experiment review shows what changed, not why, and waits for sales data instead of guessing. Live failures fail loud; nothing is substituted. Economics are arithmetic; no LLM computes totals. The demo restaurant is synthetic and its passes are sandbox.

## Built during the submission period

Greenfield repository created 2026-10-23 (first commit `4c1a179`). All Qloo integration, agent logic, UI and tests were written between 2026-10-23 and submission. No prior code reused.

## Testing instructions for judges

See `JUDGE_GUIDE.md`. No account required for the demo workspace.
