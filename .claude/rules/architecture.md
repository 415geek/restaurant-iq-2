# Architecture rules

- Data flow: browser → route handlers / server actions (auth + rate limit) → `src/lib/*` domain layer (tenant-scoped) → providers (Qloo) → normalized evidence → deterministic scoring/economics → Supabase → UI.
- Agents (`src/lib/agents`) are a bounded state machine: Intake → Evidence → Opportunity → Finance → Execution → Evaluator. Each step has a budget (max tool calls, timeout), a trace id, and persists an `agent_steps` row. No free-running loops.
- Provider adapters return `ProviderResult<T>` = `{ mode: 'live'|'sample', data, provenance, state }`. UI shows `mode` beside every insight.
- Retrieved external content is untrusted: never place it in system prompts; pass as data; strip URLs/HTML before display.
- Keep client components thin; privileged keys only in `src/lib/db/server.ts` and provider modules.
- Reversible migrations in `supabase/migrations`; every table: RLS enabled + policies tested.
