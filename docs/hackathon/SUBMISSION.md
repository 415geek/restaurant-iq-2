# Devpost submission — Restaurant IQ 2.0: Taste-to-Profit Agent

**Live demo URL:** PENDING (recorded here the moment the Vercel deployment is verified)
**Public repository:** PENDING (GitHub, MIT license visible in About)
**Deadline:** Oct 30, 2026, 11:45 pm EDT

## Project description (paste into Devpost)

**Restaurant IQ is the independent commercial decision brain for restaurants.** POS systems tell you what sold. Restaurant IQ tells you what to try next, for whom, at what margin, and keeps the decision history no matter which POS you run.

It is an agentic tool built on the Qloo Insights API. A bounded six-agent workflow (Intake → Evidence → Opportunity → Finance → Execution → Evaluator) takes a restaurant profile and asks Qloo what the people who love this cuisine, in this neighborhood, also love: which place attributes (vegetarian-friendly, late-night, bubble tea…), which demographic buckets over-index, and which non-food brands, podcasts, artists and shows share the same taste graph. Those signals re-rank a cuisine-agnostic catalog of opportunity hypotheses, change the target segment, and name concrete partners and channels.

Every hypothesis is scored on labeled dimensions (taste fit, operational fit, feasibility, deterministic unit economics, evidence quality), carries citations to the exact Qloo response that moved it, and can be rejected: constraints like "no liquor license" or "two cooks on weekdays" disqualify ideas with a reason. A "With Qloo / Without Qloo" toggle shows the generic baseline ranking next to the Qloo-informed one, so judges can see precisely what cultural intelligence added.

The Decision Lab recomputes contribution margin, break-even and cannibalization as the owner drags price, units, food cost, fees and marketing. The Action board drafts capacity checks, channel-verification tasks and an approval-gated launch post. Business memory records every decision, assumption, approval and scenario immutably.

**What is Qloo-powered:** cuisine → tag resolution (`/v2/tags`), place-attribute taste analysis (`filter.type=urn:tag`), cross-domain affinities (`urn:entity:brand|podcast|artist|tv_show` with `signal.interests.tags` and `signal.location.query`), demographic deltas (`urn:demographics`), and nearby-place affinities with `feature.explainability`. Without Qloo the engine only has operational and economic screens, and the product would be generic consulting.

**Honesty by design:** affinity is shown as a 0–1 relation, never as demand or revenue. Sample mode is synthetic, labeled on every card, and caps labels at "requires validation". Live failures fail loud instead of swapping in fixtures. Economics are arithmetic; no LLM computes totals.

## Built during the submission period

Greenfield repository created 2026-10-23 (first commit `4c1a179`). All Qloo integration, agent logic, UI and tests were written between 2026-10-23 and submission. No prior code reused.

## Testing instructions for judges

See `JUDGE_GUIDE.md`. No account required for the demo workspace.
