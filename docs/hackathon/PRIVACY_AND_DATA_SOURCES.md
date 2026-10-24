# Privacy and data sources

- **Demo tenant** is synthetic: "Golden Gate Noodle House (sample)" is not a real business; menu, costs and constraints are invented.
- **Qloo data:** fetched server-side with a hackathon key, cached privately in Supabase (`provider_cache`, `qloo_insights`) for 24 h. No Qloo response data is committed to this repository; `src/lib/providers/qloo/fixtures.ts` is synthetic.
- **Visitors:** anonymous demo use stores no personal data. Rate limiting hashes `IP + bucket` (SHA-256, truncated) in `demo_rate_limits`.
- **Accounts:** email one-time links via Supabase Auth. Restaurant data is private to the organization (RLS). Export/delete: members can delete their restaurant rows (cascade) through the database policies; a UI affordance is on the roadmap.
- **Telemetry:** `usage_events` holds provider, endpoint, cache hit, latency, error class, trace id. No request payloads, no keys.
- **Third-party terms:** Qloo hackathon API terms apply (keys deactivated after the event; private caching allowed).
