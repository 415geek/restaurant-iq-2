import type { Store } from "@/lib/front/types";

/**
 * Plain inline SVG scatter of stores by lat/lng (equirectangular, padded to the brand's bounding box), colored by heat z-score.
 * Sequential coral ramp per DESIGN.md: cool stores are faint, warm stores saturated; null heat = neutral gray. City labels sit at the city centroid.
 */
export function FleetMap({ stores, z, noHeatLabel }: { stores: Store[]; z: Record<string, number | null>; noHeatLabel: string }) {
  const W = 360, H = 240, P = 28;
  const lats = stores.map((s) => s.lat), lngs = stores.map((s) => s.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const sx = (lng: number) => (maxLng === minLng ? W / 2 : P + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * P));
  const sy = (lat: number) => (maxLat === minLat ? H / 2 : H - P - ((lat - minLat) / (maxLat - minLat)) * (H - 2 * P));
  const fill = (v: number | null) => (v === null ? "#9CA3AF" : `rgba(255,107,53,${(0.25 + 0.75 * Math.max(0, Math.min(1, (v + 2) / 4))).toFixed(2)})`);
  const cities = new Map<string, { x: number; y: number; n: number }>();
  for (const s of stores) { const c = cities.get(s.city) ?? { x: 0, y: 0, n: 0 }; cities.set(s.city, { x: c.x + sx(s.lng), y: c.y + sy(s.lat), n: c.n + 1 }); }
  return (
    <svg data-testid="fleet-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Stores by location, colored by heat" className="h-auto w-full rounded-xl bg-surface-2">
      {[...cities].map(([city, c]) => <text key={city} x={c.x / c.n} y={c.y / c.n - 12} textAnchor="middle" fontSize="10" fontWeight="600" fill="#4B5563">{city}</text>)}
      {stores.map((s) => {
        const v = z[s.id] ?? null;
        return (
          <g key={s.id}>
            <circle cx={sx(s.lng)} cy={sy(s.lat)} r={7} fill={fill(v)} stroke="#1B2A4A" strokeWidth={1} />
            <title>{`${s.name} · ${v === null ? noHeatLabel : `z ${v >= 0 ? "+" : ""}${v.toFixed(2)}`}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
