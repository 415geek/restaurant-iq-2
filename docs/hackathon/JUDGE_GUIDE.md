# Judge guide (3 minutes, no account)

1. Open the live URL (see SUBMISSION.md) → **Try the live demo**. You land in the workspace of a **synthetic** restaurant (Golden Gate Noodle House, Inner Sunset, San Francisco). The yellow banner states whether Qloo is **live** or **sample**.
2. **Snapshot:** restaurant 360°, the six-agent run with per-step status and tool-call counts, and the Trust & data panel (sources, freshness, provider state, assumptions, unknowns).
3. **Taste signals:** four Qloo-derived views, each with the exact request parameters and docs link under the card. Flip **Without Qloo / With Qloo** at the bottom: ranks change and each row says which returned signal moved it.
4. **Opportunities:** three viable hypotheses, each with cited Qloo signals, default weekly economics and missing evidence. Expand "Screened out" to see **not recommended** ideas with reasons (e.g. "no liquor license").
5. **Open a workspace:** "How Qloo changed the recommendation", score breakdown, then the **Decision Lab**: change at least three inputs and watch contribution, break-even and sensitivity recompute. Save a scenario. Click **Pursue** or **Reject**.
6. **Action board:** move a capacity task to Ready; try to move the "Publish launch post" task: it needs an approval (recorded with your note).
7. **Business memory:** every step above is now an immutable event with payload.
8. **Re-run analysis** (rate-limited for anonymous visitors: 5 runs / 10 minutes per IP).

Live vs sample: `/api/health` reports `"qloo": "live" | "sample"`. In live mode the source lines show real `/v2/insights` parameters and timestamps; in sample mode every card is labeled as an illustrative fixture.

Private workspaces: sign in with an email one-time link, add your own restaurant (a few menu lines are enough), run an analysis. Row-level security isolates organizations; cross-tenant reads/writes are covered by an integration test.
