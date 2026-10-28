# Judge guide (3 minutes, no account)

You need a laptop and a phone. Everything runs against **live Qloo data** (green "Live Qloo" pill; `/api/health` returns `"qloo":"live"`). The restaurant, menu and costs are **synthetic** and labeled; passes from it are sandbox and not redeemable for real food.

1. **Open the live URL** (see `SUBMISSION.md`) → **Try the live demo**. You land on Golden Gate Noodle House (sample), Inner Sunset, San Francisco.
2. **Signals.** Click a preset under **Pick a cultural anchor** (e.g. *Mitski*) or type any artist, film, brand or podcast. Qloo resolves it and shows where its fans eat in San Francisco, with an explainability badge, and how they skew by age and gender. Below: the four Qloo views for the cuisine, each with its request parameters, and the **With / Without Qloo** ranking.
2b. **Moments.** Open **Moments** in the sidebar. The calendar shows holidays (coral), street fairs and block parties from SF permit data (navy) and community events (green) within 1.5 mi of the restaurant. On Oct 31, the *Trick-or-Treat – 12th Avenue* block party is 0.2 mi away: click **Who does it draw?** Qloo shows the kids-and-families crowd skews under 35, while Taiwanese-noodle fans skew 45+: **Different crowd**, so the advice is a small test or skip. Try a farmers market for a **Strong overlap**. **Plan a pass** opens the TastePass form timed to that date.
3. **Choose → Decide.** Open an idea. "Why this one" lists the Qloo signals that moved it; the score breakdown and Decision Lab are deterministic arithmetic. Click **Turn into a TastePass** (or **Make a pass for … fans** from the anchor card).
4. **Activate.** Change the pass price to $1: the verdict turns **NO-GO** and Approve is disabled. Restore it and click **Approve TastePass**.
5. **Prove.** On the campaign page, scan the QR code with your phone (or click *Open guest view*). On the phone: tick the box, **Claim my pass**, read the 8-character code. Watch the laptop: **Claimed** goes from 0 to 1 without a reload.
6. **Redeem.** Type the code into **Redeem at the counter**: **Redeemed** goes to 1. Redeem the same code again: refused, not counted. Try `ZZZZ2222`: not found.
7. **Memory.** Every step above is an immutable event: anchor lookup, approval, claim, redemption.

Notes
- Redemption by anyone is allowed only for the synthetic demo tenant ("demo merchant mode"); private restaurants require a signed-in member.
- Anonymous actions are rate-limited per IP (claims, redemptions, anchors, mutations).
- Private workspaces: sign in with an email one-time link, add a restaurant, run an analysis. RLS isolates organizations (integration-tested).
