# Judge guide (no account needed)

Open https://restaurant-iq-2.vercel.app. Everything below runs on a synthetic demo tenant (three invented brands with invented menus on real Bay Area neighborhoods). Qloo calls are live; sales for the settlement are a labeled synthetic sample.

## TasteFront in 60 seconds

1. **Replays (home page).** Three cards: *Chuan Lane* (1 Sichuan store, San Bruno), *Cloud Nine Tea* (5 boba stores), *Bamboo Bowl* (40-store fast-casual brand). Click one. The agent log is a recorded real run; the menu on the right turns from "as printed" into the published storefront. Each change names the Qloo tag or lift term behind it.
2. **Customer menu.** *Open the customer menu* (`/m/chuan-lane-san-bruno`). Flip **Qloo on / off** at the top. Tap a badge on a changed item: tag or term, score, neighborhood, and ✓ verified / ⚠ unverified against the stored Qloo response.
3. **Owner card** (`/front`). "N moves this week" with before → after and the citation. **Press and hold Approve** for about a second (a click does nothing). **Roll back** undoes it. Press **Run agent** to watch a live run stream (rate-limited to 6 per hour per visitor).
4. **Settlement.** The card under the moves compares the change week with the control week on the demo store's sample sales: net-sales lift in dollars, orders, featured-item units, the prior-4-week range and the fluke rate. Switch the store selector to a boba store: **Waiting for sales data**, because nothing covers its window. No estimate is ever shown.
5. **HQ fleet** (`/front/fleet?brand=bamboo-bowl`). 40 stores colored by Qloo heat for the selected feature item; guardrails (renamable items, price band, banned terms, tone); the approval queue; **"N changed, M held out"** after you create a store split. Switch to `cloud-nine-tea` for the per-store comparison strip.
6. **Language.** The switcher in the footer or header changes the owner card and the menu to 中文 or Español.

## TastePass (the proof layer, 3 minutes)

7. **Try the live demo** → Golden Gate Noodle House (sample). **Signals:** pick a cultural anchor (e.g. *Mitski*): where its fans eat in San Francisco with explainability, age/gender skew, the four Qloo views for the cuisine, and the **With / Without Qloo** ranking.
8. **Recommend → Execute.** Open an idea → **Turn into a TastePass**. Set the pass price to $1: **NO-GO**, Approve disabled. Restore it; press and hold **Approve TastePass**.
9. **Prove.** Scan the QR with a phone (or *Open guest view*), claim the one-time code; **Claimed** goes 0 → 1 on the laptop without a reload. Redeem it at the counter; redeem again: refused. Try `ZZZZ2222`: not found.
10. **Experiment review.** *Plant-forward mini-menu (past week)* compares its week with the same hours in the 4 weeks before (verdict: below the prior weeks; advice: do not repeat as is). **Stop TastePass** halts claims; **Memory** lists every step as an immutable event.

## What to expect in the code

`src/lib/front/` is TasteFront: `qloo.ts` (workflows + provenance), `lift.ts`, `agent.ts`, `moves.ts` (guardrails, verifier, apply), `holdout.ts`, `settle.ts`, `menu/` (CSV, text, URL, photo, tag mapping). `tests/front/` has the unit tests; `tests/e2e/front.spec.ts` the smoke. `/api/mcp` exposes `storefront_profile` and `storefront_moves` to any MCP client.
