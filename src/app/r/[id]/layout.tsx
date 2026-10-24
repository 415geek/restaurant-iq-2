import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { WorkspaceNav } from "@/components/shell/WorkspaceNav";
import { ModeBanner } from "@/components/shell/ModeBanner";
import { getLatestRun, getRestaurantOverview } from "@/lib/queries";
import { Badge } from "@/components/ui";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/r/[id]">) {
  const { id } = await params;
  const overview = await getRestaurantOverview(id);
  if (!overview) notFound();
  const run = await getLatestRun(id);
  const p = overview.profile;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16">
        <div className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{p.name}</h1>
            {overview.isDemo ? <Badge tone="warn">Synthetic demo</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-ink-2">{p.cuisine} · {[p.neighborhood, p.city].filter(Boolean).join(", ")}</p>
        </div>
        <div className="mt-4"><ModeBanner mode={run?.mode ?? (process.env.QLOO_API_KEY ? "live" : "sample")} isDemo={overview.isDemo} /></div>
        <div className="mt-4"><WorkspaceNav base={`/r/${id}`} /></div>
        <div className="mt-5">{children}</div>
      </main>
    </>
  );
}
