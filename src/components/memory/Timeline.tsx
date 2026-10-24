import { Badge, fmtDate } from "@/components/ui";
import type { EventView } from "@/lib/queries";

const KIND: Record<string, { label: string; tone: "neutral" | "accent" | "good" | "warn" | "bad" | "muted" }> = {
  restaurant_created: { label: "Workspace", tone: "neutral" },
  analysis_completed: { label: "Analysis", tone: "accent" },
  hypothesis_pursued: { label: "Decision", tone: "good" },
  hypothesis_rejected: { label: "Decision", tone: "bad" },
  scenario_saved: { label: "Scenario", tone: "neutral" },
  action_approved: { label: "Approval", tone: "good" },
  action_status_changed: { label: "Task", tone: "muted" },
  outcome_recorded: { label: "Outcome", tone: "accent" },
};

export function Timeline({ events }: { events: EventView[] }) {
  return (
    <ol className="relative ml-2 border-l border-border pl-5">
      {events.map((e) => {
        const k = KIND[e.kind] ?? { label: e.kind, tone: "neutral" as const };
        const p = e.payload as Record<string, unknown>;
        return (
          <li key={e.id} className="relative pb-5">
            <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent" aria-hidden />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><Badge tone={k.tone}>{k.label}</Badge><time dateTime={e.createdAt}>{fmtDate(e.createdAt)}</time><span>· {e.actor}</span></div>
            <p className="mt-1 text-sm">{e.summary}</p>
            {e.kind === "analysis_completed" && Array.isArray(p.top) ? <p className="mt-0.5 text-xs text-muted">Top: {(p.top as Array<{ slug: string; label: string }>).map((t) => `${t.slug} [${t.label}]`).join(", ")} · mode {String(p.mode)} · trace {String(p.traceId ?? "").slice(0, 8)}</p> : null}
            {e.kind === "scenario_saved" && p.assumptions ? <p className="mt-0.5 text-xs text-muted">Assumptions snapshot: price ${String((p.assumptions as Record<string, unknown>).salePrice)}, units {String((p.assumptions as Record<string, unknown>).incrementalUnits)}, food cost ${String((p.assumptions as Record<string, unknown>).foodCostPerUnit)}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
