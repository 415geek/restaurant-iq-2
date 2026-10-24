import { Badge, Card, CardTitle, fmtUsd } from "@/components/ui";
import type { RestaurantOverview } from "@/lib/queries";

export function SnapshotCard({ overview }: { overview: RestaurantOverview }) {
  const p = overview.profile;
  const cats = Array.from(new Set(overview.menu.map((m) => m.category)));
  const withCost = overview.menu.filter((m) => m.price && m.foodCost);
  const avgFoodCostPct = withCost.length ? withCost.reduce((a, m) => a + Number(m.foodCost) / Number(m.price), 0) / withCost.length : null;
  const strengths = [
    overview.menu.some((m) => m.isSignature) ? `Signature dishes: ${overview.menu.filter((m) => m.isSignature).map((m) => m.name).join(", ")}` : null,
    p.serviceFormats.includes("third_party_delivery") ? "Delivery channel already enabled" : null,
    avgFoodCostPct !== null && avgFoodCostPct < 0.35 ? `Average food cost ${(avgFoodCostPct * 100).toFixed(0)}% on costed items` : null,
  ].filter((x): x is string => !!x);
  const constraints = p.objectives.constraints ?? [];
  return (
    <Card>
      <CardTitle hint={`${p.cuisine} · ${[p.neighborhood, p.city].filter(Boolean).join(", ")}`}>Restaurant 360°</CardTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Profile</h3>
          <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted">Formats</dt><dd>{p.serviceFormats.map((f) => f.replace(/_/g, " ")).join(", ") || "—"}</dd>
            <dt className="text-muted">Hours</dt><dd>{p.hoursSummary ?? "unknown"}</dd>
            <dt className="text-muted">Price level</dt><dd>{p.priceLevel ? "$".repeat(p.priceLevel) : "unknown"}</dd>
            <dt className="text-muted">Avg ticket</dt><dd>{p.costAssumptions.avg_ticket ? fmtUsd(p.costAssumptions.avg_ticket) : "unknown"}</dd>
            <dt className="text-muted">POS</dt><dd>{p.posPreference && p.posPreference !== "none" ? `${p.posPreference} (not connected)` : "none connected"}</dd>
          </dl>
        </div>
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Menu map ({overview.menu.length} items)</h3>
          <div className="flex flex-wrap gap-1.5">{cats.map((c) => <Badge key={c}>{c.replace(/_/g, " ")} · {overview.menu.filter((m) => m.category === c).length}</Badge>)}</div>
          {overview.menu.length === 0 ? <p className="text-sm text-muted">No menu items yet.</p> : null}
        </div>
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Strengths</h3>
          {strengths.length ? <ul className="list-disc pl-4 text-sm text-ink-2">{strengths.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="text-sm text-muted">Add menu costs to surface strengths.</p>}
        </div>
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Constraints &amp; objective</h3>
          <p className="text-sm">{p.objectives.primary ?? <span className="text-muted">No objective stated</span>}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">{constraints.map((c) => <Badge key={c} tone="warn">{c}</Badge>)}</div>
        </div>
      </div>
    </Card>
  );
}
