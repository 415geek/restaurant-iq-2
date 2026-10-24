import { ModeBadge } from "@/components/ui";

export function ModeBanner({ mode, isDemo }: { mode: "live" | "sample" | null; isDemo: boolean }) {
  if (mode === "live" && !isDemo) return null;
  return (
    <div className="card flex flex-wrap items-center gap-x-3 gap-y-1 border-warn/30 bg-warn-soft/40 px-4 py-2 text-sm" role="status">
      <ModeBadge mode={mode} />
      {isDemo ? <span><strong>Synthetic demo restaurant.</strong> Not a real business; data is seeded for judging.</span> : null}
      {mode !== "live" ? <span className="text-ink-2">Live Qloo not connected: taste signals below are an illustrative sample fixture, labeled on every card.</span> : null}
    </div>
  );
}
