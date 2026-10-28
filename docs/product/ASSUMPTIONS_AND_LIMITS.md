# Assumptions and limits

- Qloo affinity (0–1) is a taste relation, not demand; demographic values are signed deviations from average; popularity is a percentile.
- Live verification (2026-10-27): place, tag and cross-domain results carry `query.affinity`; explainability arrives as a list of `{entity_id, score}` and is reduced to the strongest score.
- On the hackathon tier, an untyped `filter.type=urn:tag` call returns only dish tags, and several place tag types (offerings, amenity, dining options) return nothing; we query genre, ambience, customer identity and dishes separately.
- Default scenario assumptions (units/week, marketing, setup) are editable placeholders, labeled as such.
- Sample mode fixtures are synthetic and cap every label at "requires validation".
- Channel eligibility and fees are never assumed; they are tasks with status `not_verified`.
- No POS data: baselines must be measured by the owner (2-week pre-launch count).
- Rate limits are per IP; shared networks share a bucket.
- **TastePass:** a claim is an intent, a redemption is a visit. Neither proves incremental sales. Guests may have come anyway; compare with a week without the pass or a second pass. Sample sizes in a pilot are small.
- Claimed codes expire after 3 days or at the campaign end. One network can claim at most 5 passes per campaign.
- Demo merchant mode lets anyone redeem passes of the synthetic tenant. Real tenants require a signed-in member.
- Cultural anchors show taste overlap in a city, not foot traffic, audience size or purchase intent.
- Out of scope: POS write-back, payments, CRM/loyalty, ad buying, multi-merchant marketplace.

## Moments
- City permit data shows that an event is scheduled, not how many people will come. We show no attendance numbers.
- Qloo describes people who like a *kind* of event (a theme tag), not the people at this specific event.
- The theme classifier is keyword-based; the owner can change the theme on any row.
- Live event feeds cover San Francisco only. Neighborhood distance uses approximate neighborhood centers.
- Web events come from Google Events cards via SerpApi. They are labeled "found on the web" and link to the source so the owner can verify; dates without a year are assumed to be the next occurrence.
- Live permit feeds: San Francisco, New York, Chicago. Other cities rely on web results and manual entry.

## Sales data
- Direct POS/delivery connections are not built yet; file uploads work for every platform. Square/Clover OAuth is planned; Toast, DoorDash, Uber Eats and Grubhub APIs require partner approval.
- Times without an offset are read as restaurant local time (America/Los_Angeles for now). Slash dates are month-first unless a value proves day-first.
- One file per request, 4 MB max (hosting limit). Re-uploading an identical file is refused so nothing is counted twice.
- Analysis describes the uploaded period only; it is not a forecast. Suggested actions are rules, and every pass still needs owner approval.
- The Business Brain lives in this app's database. The developer GBrain never receives customer or operating data.
