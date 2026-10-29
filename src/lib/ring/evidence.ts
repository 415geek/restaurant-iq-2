import "server-only";
import { getServiceClient } from "@/lib/db/server";
import { shiftLocalDays } from "@/lib/business/experiment";
import { countByLocalDay } from "@/lib/ring/core";

export type RingEvidence = {
  linkedAt: string | null;
  window: { start: string; end: string } | null;  // pass window clipped to now; null if the pass has not started
  passCount: number;
  prior: { start: string; end: string; count: number } | null; // same local window one week earlier, only if the camera was linked by then
  last7: { day: string; count: number }[];
};

/** Person-motion events for the pass card. Returns null when no Ring camera has ever sent events or been linked here. */
export async function loadRingEvidence(restaurantId: string, startsAt: string, endsAt: string, tz: string, now = Date.now()): Promise<RingEvidence | null> {
  const db = getServiceClient();
  const { data: conn } = await db.from("ring_connections").select("linked_at").eq("restaurant_id", restaurantId).eq("status", "linked").order("linked_at", { ascending: true }).limit(1).maybeSingle();
  const since = new Date(now - 14 * 86400_000).toISOString();
  const s = Date.parse(startsAt), e = Math.min(Date.parse(endsAt), now);
  const priorS = shiftLocalDays(s, 7, tz), priorE = shiftLocalDays(e, 7, tz);
  const from = new Date(Math.min(priorS, Date.parse(since))).toISOString();
  const { data: rows } = await db.from("ring_events").select("occurred_at").eq("restaurant_id", restaurantId).gte("occurred_at", from).order("occurred_at").limit(20000);
  const times = (rows ?? []).map((r) => r.occurred_at as string);
  if (!conn && times.length === 0) return null;
  const linkedAt = (conn?.linked_at as string | null) ?? null;
  const inRange = (a: number, b: number) => times.filter((t) => { const x = Date.parse(t); return x >= a && x < b; }).length;
  const started = s <= now;
  const priorCovered = linkedAt !== null && Date.parse(linkedAt) <= priorS;
  const byDay = countByLocalDay(times.filter((t) => t >= since), tz);
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const last7 = Array.from({ length: 7 }, (_, i) => fmt.format(new Date(now - (6 - i) * 86400_000))).map((day) => ({ day, count: byDay.get(day) ?? 0 }));
  return {
    linkedAt,
    window: started ? { start: new Date(s).toISOString(), end: new Date(e).toISOString() } : null,
    passCount: started ? inRange(s, e) : 0,
    prior: started && priorCovered ? { start: new Date(priorS).toISOString(), end: new Date(priorE).toISOString(), count: inRange(priorS, priorE) } : null,
    last7,
  };
}
