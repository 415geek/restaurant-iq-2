import Link from "next/link";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { Badge, Button, Card, Empty, ModeBadge } from "@/components/ui";
import { getMyRestaurants } from "@/lib/queries";

export const metadata = { title: "My restaurants" };

export default async function AppHome() {
  const mine = await getMyRestaurants();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-2xl font-semibold tracking-tight">My restaurants</h1><p className="text-sm text-muted">Private workspaces. Only members of your organization can see them.</p></div>
          <Button href="/app/restaurants/new">Add a restaurant</Button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((r) => (
            <Card key={r.id} as="article">
              <div className="flex items-start justify-between gap-2"><h2 className="font-semibold"><Link href={`/r/${r.id}`} className="hover:underline">{r.name}</Link></h2><ModeBadge mode={r.dataMode} /></div>
              <p className="mt-1 text-sm text-ink-2">{r.cuisine} · {[r.neighborhood, r.city].filter(Boolean).join(", ")}</p>
              <div className="mt-3"><Badge tone="muted">created {new Date(r.createdAt).toLocaleDateString()}</Badge></div>
            </Card>
          ))}
        </div>
        {mine.length === 0 ? <div className="mt-6"><Empty title="No restaurants yet" body="Create a workspace with a few menu items and your objective. The analysis works without a POS." action={<Button href="/app/restaurants/new">Add a restaurant</Button>} /></div> : null}
      </main>
    </>
  );
}
