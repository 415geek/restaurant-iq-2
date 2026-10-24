import { describe, it, expect, vi } from "vitest";
import { MemoryGuardStore, QlooUsageGuard, cacheKey } from "@/lib/providers/qloo/guard";
import { QlooProvider, SAMPLE_LABEL } from "@/lib/providers/qloo";
import { QlooError } from "@/lib/providers/qloo/types";

describe("QlooUsageGuard", () => {
  it("caches by sorted params and records cache hits", async () => {
    const store = new MemoryGuardStore();
    const g = new QlooUsageGuard({ store, ttlSeconds: 60 });
    const call = vi.fn(async () => ({ data: { v: 1 }, latencyMs: 5 }));
    const a = await g.run("/x", { b: "2", a: "1" }, call);
    const b = await g.run("/x", { a: "1", b: "2" }, call);
    expect(call).toHaveBeenCalledTimes(1);
    expect(a.cacheHit).toBe(false);
    expect(b.cacheHit).toBe(true);
    expect(store.events.map((e) => e.cacheHit)).toEqual([false, true]);
    expect(cacheKey("/x", { b: "2", a: "1" })).toBe("qloo:/x?a=1&b=2");
  });

  it("enforces the daily cap", async () => {
    const store = new MemoryGuardStore();
    const g = new QlooUsageGuard({ store, dailyCap: 1 });
    await g.run("/x", { a: "1" }, async () => ({ data: 1, latencyMs: 1 }));
    await expect(g.run("/x", { a: "2" }, async () => ({ data: 2, latencyMs: 1 }))).rejects.toMatchObject({ errorClass: "quota_exceeded" });
  });

  it("records error classes from failed calls", async () => {
    const store = new MemoryGuardStore();
    const g = new QlooUsageGuard({ store });
    await expect(g.run("/x", {}, async () => { throw new QlooError("timeout", "t"); })).rejects.toBeInstanceOf(QlooError);
    expect(store.events[0].errorClass).toBe("timeout");
  });
});

describe("QlooProvider", () => {
  it("runs in sample mode without a key and labels provenance", async () => {
    const p = new QlooProvider({});
    expect(p.mode).toBe("sample");
    const r = await p.getLocalPlaceAffinities({ tagIds: ["urn:tag:genre:place:restaurant:taiwanese"] });
    expect(r.provenance.mode).toBe("sample");
    expect(r.state.status).toBe("not_connected");
    expect(r.state.message).toContain(SAMPLE_LABEL);
    expect(r.data.length).toBeGreaterThan(0);
    const v = await p.verifyLive();
    expect(v.ok).toBe(false);
  });

  it("in live mode never substitutes fixtures on failure", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 500 }));
    const p = new QlooProvider({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(p.mode).toBe("live");
    await expect(p.getTagAffinities({ tagIds: ["t"] })).rejects.toMatchObject({ errorClass: "server" });
  });

  it("in live mode normalizes real-shaped responses with provenance", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      new Response(JSON.stringify({ success: true, results: { entities: [{ entity_id: "e1", name: "Place", subtype: "urn:entity:place", query: { affinity: 0.7 } }] } }), { status: 200 }),
    );
    const p = new QlooProvider({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch, traceId: "tr1" });
    const r = await p.getLocalPlaceAffinities({ tagIds: ["t"], geo: { localityQuery: "Inner Sunset, San Francisco" } });
    expect(r.data[0].affinity).toBe(0.7);
    expect(r.provenance.mode).toBe("live");
    expect(r.provenance.requestParams["filter.location.query"]).toBe("Inner Sunset, San Francisco");
    expect(r.provenance.requestParams).not.toHaveProperty("X-Api-Key");
    expect(r.provenance.traceId).toBe("tr1");
  });

  it("cross-domain skips forbidden entity types but fails if all are rejected", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const t = new URL(url).searchParams.get("filter.type");
      if (t === "urn:entity:brand") return new Response(JSON.stringify({ results: { entities: [{ entity_id: "b", name: "Brand", subtype: "urn:entity:brand" }] } }), { status: 200 });
      return new Response("{}", { status: 403 });
    });
    const p = new QlooProvider({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    const r = await p.getCrossDomainAffinities({ tagIds: ["t"], domains: ["urn:entity:brand", "urn:entity:podcast"] });
    expect(r.data).toHaveLength(1);
    expect(r.failedDomains).toEqual(["urn:entity:podcast"]);
    const all403 = new QlooProvider({ apiKey: "k", fetchImpl: (async () => new Response("{}", { status: 403 })) as unknown as typeof fetch });
    await expect(all403.getCrossDomainAffinities({ tagIds: ["t"], domains: ["urn:entity:podcast"] })).rejects.toMatchObject({ errorClass: "forbidden" });
  });
});
