/**
 * Runs the daily local-events refresh against a running server (same code path as Vercel Cron).
 * Usage: bun --env-file=.env.local scripts/refresh-events.ts [baseUrl] [--force-web]
 */
const base = process.argv.find((a, i) => i > 1 && a.startsWith("http")) ?? "http://localhost:3000";
const force = process.argv.includes("--force-web") ? "?force=web" : "";
const res = await fetch(`${base}/api/cron/refresh-events${force}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
console.log(res.status, JSON.stringify(await res.json(), null, 1));
export {};
