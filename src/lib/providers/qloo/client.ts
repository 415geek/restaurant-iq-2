/**
 * Minimal typed Qloo HTTP client (hackathon tier): GET only, X-Api-Key header,
 * timeout, bounded retries with backoff on 429/5xx, error classification.
 * No fallback logic lives here: a failure is thrown as QlooError.
 */
import {
  QlooError,
  rawInsightsEnvelope,
  rawSearchEnvelope,
  type InsightsParams,
  type RawInsightsEnvelope,
  type RawSearchEnvelope,
  type SearchParams,
  type TagsParams,
} from "./types";

export interface QlooClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface QlooCallMeta {
  endpoint: string;
  params: Record<string, string>;
  latencyMs: number;
  status: number;
  attempts: number;
}

export const QLOO_DEFAULT_BASE_URL = "https://hackathon.api.qloo.com";
export const QLOO_DOC_URLS: Record<string, string> = {
  "/v2/insights": "https://docs.qloo.com/reference/insights-api-deep-dive",
  "/search": "https://docs.qloo.com/reference/get-search",
  "/v2/tags": "https://docs.qloo.com/reference/get-tags",
  "/entities": "https://docs.qloo.com/reference/get-entities",
};

export function toQuery(params: object): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = Array.isArray(v) ? v.join(",") : String(v);
  }
  return out;
}

export class QlooClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: QlooClientOptions) {
    if (!opts.apiKey) throw new QlooError("no_key", "QLOO_API_KEY is not configured");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? QLOO_DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 8000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async insights(params: InsightsParams): Promise<{ data: RawInsightsEnvelope; meta: QlooCallMeta }> {
    const { json, meta } = await this.get("/v2/insights", toQuery(params));
    const parsed = rawInsightsEnvelope.safeParse(json);
    if (!parsed.success) throw new QlooError("malformed", "Unexpected /v2/insights payload shape");
    return { data: parsed.data, meta };
  }

  async search(params: SearchParams): Promise<{ data: RawSearchEnvelope; meta: QlooCallMeta }> {
    const { json, meta } = await this.get("/search", toQuery(params));
    const parsed = rawSearchEnvelope.safeParse(json);
    if (!parsed.success) throw new QlooError("malformed", "Unexpected /search payload shape");
    return { data: parsed.data, meta };
  }

  async tags(params: TagsParams): Promise<{ data: RawInsightsEnvelope; meta: QlooCallMeta }> {
    const { json, meta } = await this.get("/v2/tags", toQuery(params));
    const parsed = rawInsightsEnvelope.safeParse(json);
    if (!parsed.success) throw new QlooError("malformed", "Unexpected /v2/tags payload shape");
    return { data: parsed.data, meta };
  }

  async entities(entityIds: string[]): Promise<{ data: RawSearchEnvelope; meta: QlooCallMeta }> {
    const { json, meta } = await this.get("/entities", { entity_ids: entityIds.join(",") });
    const parsed = rawSearchEnvelope.safeParse(json);
    if (!parsed.success) throw new QlooError("malformed", "Unexpected /entities payload shape");
    return { data: parsed.data, meta };
  }

  private async get(endpoint: string, params: Record<string, string>): Promise<{ json: unknown; meta: QlooCallMeta }> {
    const url = new URL(this.baseUrl + endpoint);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const started = Date.now();
    let attempt = 0;
    let lastErr: QlooError | undefined;
    while (attempt <= this.maxRetries) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url.toString(), {
          method: "GET",
          headers: { "X-Api-Key": this.apiKey, Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timer);
        const status = res.status;
        if (status === 429 || status >= 500) {
          lastErr = new QlooError(status === 429 ? "rate_limited" : "server", `Qloo responded ${status}`, status);
          if (attempt <= this.maxRetries) {
            await this.sleep(Math.min(250 * 2 ** (attempt - 1), 2000));
            continue;
          }
          throw lastErr;
        }
        if (status === 401 || status === 403) throw new QlooError("forbidden", "Qloo rejected the API key or entity type", status);
        if (status === 404) throw new QlooError("not_found", "Qloo returned no results", status);
        if (status >= 400) throw new QlooError("bad_request", `Qloo rejected the request (${status})`, status);
        let json: unknown;
        try {
          json = await res.json();
        } catch {
          throw new QlooError("malformed", "Qloo response was not JSON", status);
        }
        return { json, meta: { endpoint, params, latencyMs: Date.now() - started, status, attempts: attempt } };
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof QlooError) throw err;
        const isAbort = (err as { name?: string })?.name === "AbortError";
        lastErr = new QlooError(isAbort ? "timeout" : "network", isAbort ? "Qloo request timed out" : "Network error calling Qloo");
        if (attempt <= this.maxRetries) {
          await this.sleep(Math.min(250 * 2 ** (attempt - 1), 2000));
          continue;
        }
        throw lastErr;
      }
    }
    throw lastErr ?? new QlooError("network", "Qloo request failed");
  }
}
