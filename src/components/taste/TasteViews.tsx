import { Badge, Bar, Card, CardTitle, DivergingBar, ModeBadge, cx } from "@/components/ui";
import { AGE_BUCKETS, type AudienceAffinity, type CulturalSignal, type TagSignal } from "@/lib/providers/qloo/types";
import type { EvidenceSourceView } from "@/lib/queries";

const AGE_LABEL: Record<string, string> = { "24_and_younger": "≤24", "25_to_29": "25–29", "30_to_34": "30–34", "35_to_44": "35–44", "45_to_54": "45–54", "55_and_older": "55+" };

export function SourceLine({ source }: { source?: EvidenceSourceView }) {
  if (!source) return null;
  const params = Object.entries(source.requestParams).filter(([k]) => k !== "take").map(([k, v]) => `${k}=${v}`).join(" · ");
  return (
    <p className="mt-2 break-all font-mono text-[11px] leading-4 text-muted">
      {source.provider} GET {source.endpoint} · {params} · {new Date(source.retrievedAt).toLocaleDateString()} {source.citationUrl ? <a className="underline" href={source.citationUrl} target="_blank" rel="noreferrer">docs</a> : null}
    </p>
  );
}

export function TagAffinityCard({ tags, source, mode }: { tags: TagSignal[]; source?: EvidenceSourceView; mode: "live" | "sample" | null }) {
  const sorted = [...tags].sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0)).slice(0, 10);
  return (
    <Card>
      <CardTitle hint="Place attributes this cuisine's audience associates with, near the restaurant. Taste affinity 0–1, not demand." right={<ModeBadge mode={mode} />}>Taste map: place attributes</CardTitle>
      {sorted.length === 0 ? <p className="text-sm text-muted">No tag signals returned.</p> : sorted.map((t) => <Bar key={t.tagId} value={t.affinity} label={t.name} />)}
      <SourceLine source={source} />
    </Card>
  );
}

export function DemographicsCard({ demo, source, mode }: { demo: AudienceAffinity[]; source?: EvidenceSourceView; mode: "live" | "sample" | null }) {
  const d = demo[0];
  return (
    <Card>
      <CardTitle hint="Signed deviation from average affinity for the cuisine tags. Positive = over-indexes." right={<ModeBadge mode={mode} />}>Audience shape</CardTitle>
      {!d ? <p className="text-sm text-muted">No demographic signal returned.</p> : (
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>{AGE_BUCKETS.map((b) => (d.age[b] !== undefined ? <DivergingBar key={b} label={AGE_LABEL[b]} value={d.age[b]!} /> : null))}</div>
          <div className="min-w-[10rem]">
            {(["male", "female"] as const).map((g) => (d.gender[g] !== undefined ? <DivergingBar key={g} label={g} value={d.gender[g]!} /> : null))}
          </div>
        </div>
      )}
      <SourceLine source={source} />
    </Card>
  );
}

const DOMAIN_LABEL: Record<string, string> = { brand: "Brand", podcast: "Podcast", artist: "Artist", tv_show: "TV show", movie: "Movie", book: "Book", place: "Place", destination: "Destination", videogame: "Video game", unknown: "Entity" };

export function CrossDomainCard({ items, source, mode, failedDomains }: { items: CulturalSignal[]; source?: EvidenceSourceView; mode: "live" | "sample" | null; failedDomains?: string[] }) {
  const sorted = [...items].sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0)).slice(0, 8);
  return (
    <Card>
      <CardTitle hint="What else this cuisine's fans love: brands, podcasts, artists, shows. These become partner, channel and messaging hooks." right={<ModeBadge mode={mode} />}>Cross-domain affinities</CardTitle>
      {sorted.length === 0 ? <p className="text-sm text-muted">No cross-domain entities returned{failedDomains?.length ? ` (unavailable: ${failedDomains.join(", ")})` : ""}.</p> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {sorted.map((c) => (
            <li key={c.entityId} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="text-xs text-muted">{DOMAIN_LABEL[c.domain] ?? c.domain}{c.tags[0] ? ` · ${c.tags[0].name}` : ""}</div>
              </div>
              <div className="tabular text-right text-xs">
                <div className="font-medium">{c.affinity !== undefined ? c.affinity.toFixed(2) : "n/a"}</div>
                <div className="text-muted">affinity</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {failedDomains?.length ? <p className="mt-2 text-xs text-muted">Unavailable on this key: {failedDomains.join(", ")}</p> : null}
      <SourceLine source={source} />
    </Card>
  );
}

export function LocalPlacesCard({ places, source, mode }: { places: CulturalSignal[]; source?: EvidenceSourceView; mode: "live" | "sample" | null }) {
  const sorted = [...places].sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0)).slice(0, 8);
  return (
    <Card>
      <CardTitle hint="Nearby places with high affinity for the same audience: adjacent formats and competitor context, not a market-share estimate." right={<ModeBadge mode={mode} />}>Market radar: nearby places</CardTitle>
      {sorted.length === 0 ? <p className="text-sm text-muted">No nearby places returned.</p> : (
        <ul className="divide-y divide-border">
          {sorted.map((p) => (
            <li key={p.entityId} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">{p.tags.slice(0, 3).map((t) => <Badge key={t.id}>{t.name}</Badge>)}{p.properties.priceLevel ? <Badge tone="muted">{"$".repeat(p.properties.priceLevel)}</Badge> : null}</div>
              </div>
              <div className={cx("tabular shrink-0 text-xs", p.affinity === undefined && "text-muted")}>{p.affinity !== undefined ? p.affinity.toFixed(2) : "n/a"}</div>
            </li>
          ))}
        </ul>
      )}
      <SourceLine source={source} />
    </Card>
  );
}
