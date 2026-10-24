import { notFound } from "next/navigation";
import { Empty, Button } from "@/components/ui";
import { ActionBoard } from "@/components/actions/ActionBoard";
import { getActions, getRestaurantOverview } from "@/lib/queries";

export const metadata = { title: "Action board" };

export default async function ActionsPage({ params }: PageProps<"/r/[id]/actions">) {
  const { id } = await params;
  const [overview, actions] = await Promise.all([getRestaurantOverview(id), getActions(id)]);
  if (!overview) notFound();
  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-xl font-semibold">Action board</h2>
        <p className="text-sm text-muted">Draft → needs approval → ready → in progress → completed. Anything that touches the outside world (posting, publishing, outreach) waits in “needs approval” until a human approves it.</p>
      </div>
      {actions.length ? <ActionBoard actions={actions} /> : <Empty title="No tasks yet" body="Run an analysis; the ExecutionAgent drafts capacity checks, channel verification tasks and one approval-gated launch post per viable hypothesis." action={<Button href={`/r/${id}`} variant="secondary">Go to snapshot</Button>} />}
    </div>
  );
}
