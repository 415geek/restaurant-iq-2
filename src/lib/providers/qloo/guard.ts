/**
 * QlooUsageGuard: caching with TTL, daily call cap, concurrency cap, sanitized usage events.
 * Storage is abstracted so unit tests use memory and the server uses Supabase (provider_cache / usage_events).
 */
import { QlooError } from "./types";

export interface CacheEntry {
  payload: unknown;
  expiresAt: number; // epoch ms
}

export interface UsageEvent {
  provider: "qloo";
  endpoint: string;
  cacheHit: boolean;
  latencyMs?: number;
  errorClass?: string;
  traceId?: string;
  createdAt: string;
}

export interface GuardStore {
  getCache(key: string): Promise<CacheEntry | undefined>;
  setCache(key: string, entry: CacheEntry): Promise<void>;
  countCallsSince(sinceIso: string): Promise<number>; // live (non-cache) calls
  recordUsage(ev: UsageEvent): Promise<void>;
}

export class MemoryGuardStore implements GuardStore {
  cache = new Map<string, CacheEntry>();
  events: UsageEvent[] = [];
  async getCache(key: string) {
    return this.cache.get(key);
  }
  async setCache(key: string, entry: CacheEntry) {
    this.cache.set(key, entry);
  }
  async countCallsSince(sinceIso: string) {
    const since = Date.parse(sinceIso);
    return this.events.filter((e) => !e.cacheHit && Date.parse(e.createdAt) >= since).length;
  }
  async recordUsage(ev: UsageEvent) {
    this.events.push(ev);
  }
}

export interface GuardOptions {
  store: GuardStore;
  ttlSeconds?: number;
  dailyCap?: number;
  maxConcurrent?: number;
  now?: () => number;
}

export function cacheKey(endpoint: string, params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `qloo:${endpoint}?${sorted}`;
}

export class QlooUsageGuard {
  private readonly store: GuardStore;
  private readonly ttlMs: number;
  private readonly dailyCap: number;
  private readonly maxConcurrent: number;
  private readonly now: () => number;
  private inflight = 0;

  constructor(opts: GuardOptions) {
    this.store = opts.store;
    this.ttlMs = (opts.ttlSeconds ?? 86400) * 1000;
    this.dailyCap = opts.dailyCap ?? 400;
    this.maxConcurrent = opts.maxConcurrent ?? 4;
    this.now = opts.now ?? (() => Date.now());
  }

  /** Wraps a live call with cache + quota + concurrency + usage logging. */
  async run<T>(
    endpoint: string,
    params: Record<string, string>,
    call: () => Promise<{ data: T; latencyMs: number }>,
    traceId?: string,
  ): Promise<{ data: T; cacheHit: boolean; latencyMs?: number }> {
    const key = cacheKey(endpoint, params);
    const cached = await this.store.getCache(key);
    if (cached && cached.expiresAt > this.now()) {
      await this.store.recordUsage({ provider: "qloo", endpoint, cacheHit: true, traceId, createdAt: new Date(this.now()).toISOString() });
      return { data: cached.payload as T, cacheHit: true };
    }
    const dayStart = new Date(this.now());
    dayStart.setUTCHours(0, 0, 0, 0);
    const used = await this.store.countCallsSince(dayStart.toISOString());
    if (used >= this.dailyCap) {
      await this.store.recordUsage({ provider: "qloo", endpoint, cacheHit: false, errorClass: "quota_exceeded", traceId, createdAt: new Date(this.now()).toISOString() });
      throw new QlooError("quota_exceeded", `Daily Qloo call cap (${this.dailyCap}) reached`);
    }
    if (this.inflight >= this.maxConcurrent) {
      throw new QlooError("rate_limited", "Too many concurrent Qloo requests");
    }
    this.inflight += 1;
    try {
      const { data, latencyMs } = await call();
      await this.store.setCache(key, { payload: data, expiresAt: this.now() + this.ttlMs });
      await this.store.recordUsage({ provider: "qloo", endpoint, cacheHit: false, latencyMs, traceId, createdAt: new Date(this.now()).toISOString() });
      return { data, cacheHit: false, latencyMs };
    } catch (err) {
      const errorClass = err instanceof QlooError ? err.errorClass : "network";
      await this.store.recordUsage({ provider: "qloo", endpoint, cacheHit: false, errorClass, traceId, createdAt: new Date(this.now()).toISOString() });
      throw err;
    } finally {
      this.inflight -= 1;
    }
  }
}
