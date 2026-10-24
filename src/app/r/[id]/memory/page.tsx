import { notFound } from "next/navigation";
import { Card, CardTitle, Empty } from "@/components/ui";
import { Timeline } from "@/components/memory/Timeline";
import { getDecisionEvents, getRestaurantOverview } from "@/lib/queries";

export const metadata = { title: "Business memory" };

export default async function MemoryPage({ params }: PageProps<"/r/[id]/memory">) {
  const { id } = await params;
  const [overview, events] = await Promise.all([getRestaurantOverview(id), getDecisionEvents(id)]);
  if (!overview) notFound();
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardTitle hint="Immutable, append-only log of inputs, evidence snapshots, decisions, assumptions, approvals and outcomes. Independent of any POS.">Business memory</CardTitle>
        {events.length ? <Timeline events={events} /> : <Empty title="Nothing recorded yet" body="Decisions, scenarios and approvals will appear here." />}
      </Card>
      <Card>
        <CardTitle>Why this exists</CardTitle>
        <p className="text-sm text-ink-2">POS systems remember what sold. They do not remember why you changed the menu, what evidence you used, which assumptions were wrong, or what you decided not to do. Restaurant IQ keeps that history so recommendations can be re-examined when the signals change, even if you switch POS.</p>
        <p className="mt-3 text-sm text-ink-2">Outcome logging (observed period, baseline vs actual, attribution limits, repeat/revise/stop) is recorded per pursued hypothesis after the experiment window.</p>
      </Card>
    </div>
  );
}
