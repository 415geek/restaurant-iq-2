import "server-only";
import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/db/server";

/** Fixed-window limiter keyed by a hashed client identifier (IP + route). Stored in demo_rate_limits. */
export async function checkDemoRateLimit(input: { ip: string; bucket: string; limit?: number; windowSeconds?: number }): Promise<{ ok: boolean; remaining: number; retryAfterSeconds: number }> {
  const limit = input.limit ?? Number(process.env.DEMO_RATE_LIMIT_PER_10MIN ?? 20);
  const windowSeconds = input.windowSeconds ?? 600;
  const key = createHash("sha256").update(`${input.bucket}:${input.ip}`).digest("hex").slice(0, 32);
  const db = getServiceClient();
  const now = Date.now();
  const { data } = await db.from("demo_rate_limits").select("window_start,count").eq("key", key).maybeSingle();
  let count = 0;
  let windowStart = now;
  if (data && now - Date.parse(data.window_start) < windowSeconds * 1000) {
    count = data.count;
    windowStart = Date.parse(data.window_start);
  }
  if (count >= limit) {
    return { ok: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowSeconds * 1000 - now) / 1000)) };
  }
  await db.from("demo_rate_limits").upsert({ key, window_start: new Date(windowStart).toISOString(), count: count + 1 });
  return { ok: true, remaining: limit - count - 1, retryAfterSeconds: 0 };
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}
