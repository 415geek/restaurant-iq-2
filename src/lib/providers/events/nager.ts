import "server-only";

/** Nager.Date public holidays (free, no key). Keeps national holidays plus those observed in the restaurant's state/region. */
export interface PublicHoliday { date: string; name: string; regional: boolean }
export function filterRegional(rows: Array<{ date?: string; name?: string; global?: boolean; counties?: string[] | null }>, country: string, region?: string | null): PublicHoliday[] {
  const code = region ? `${country}-${region}`.toUpperCase() : null;
  return rows
    .filter((r) => r.date && r.name && (r.global || (code && (r.counties ?? []).includes(code))))
    .map((r) => ({ date: String(r.date).slice(0, 10), name: String(r.name).slice(0, 80), regional: !r.global }));
}
export async function getPublicHolidays(years: number[], country = "US", region?: string | null): Promise<{ state: "ok" | "error"; holidays: PublicHoliday[]; errorClass?: string }> {
  try {
    const all = await Promise.all(years.map(async (y) => {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/${country}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`http_${res.status}`);
      return (await res.json()) as Array<{ date?: string; name?: string; global?: boolean; counties?: string[] | null }>;
    }));
    return { state: "ok", holidays: filterRegional(all.flat(), country, region) };
  } catch (e) {
    return { state: "error", holidays: [], errorClass: e instanceof Error ? (e.name === "TimeoutError" ? "timeout" : e.message.slice(0, 40)) : "error" };
  }
}
