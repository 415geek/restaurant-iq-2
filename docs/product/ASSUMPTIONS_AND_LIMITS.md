# Assumptions and limits

- Qloo affinity (0–1) is a taste relation, not demand; demographic values are signed deviations from average; popularity is a percentile.
- Per-entity `query.affinity` for place results is optional in the normalizer because the public docs do not show it in samples; live verification will confirm.
- Default scenario assumptions (units/week, marketing, setup) are editable placeholders, labeled as such.
- Sample mode fixtures are synthetic and cap every label at "requires validation".
- Channel eligibility and fees are never assumed; they are tasks with status `not_verified`.
- No POS data: baselines must be measured by the owner (2-week pre-launch count).
- Rate limits are per IP; shared networks share a bucket.
