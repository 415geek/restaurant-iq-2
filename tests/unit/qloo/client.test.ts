import { describe, it, expect, vi } from "vitest";
import { QlooClient, toQuery } from "@/lib/providers/qloo/client";
import { QlooError } from "@/lib/providers/qloo/types";

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("QlooClient", () => {
  it("throws no_key without an API key", () => {
    expect(() => new QlooClient({ apiKey: "" })).toThrowError(QlooError);
  });

  it("sends X-Api-Key and dot-notation query params on GET", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = new URL(String(url));
      expect(u.origin).toBe("https://hackathon.api.qloo.com");
      expect(u.pathname).toBe("/v2/insights");
      expect(u.searchParams.get("filter.type")).toBe("urn:entity:place");
      expect(u.searchParams.get("feature.explainability")).toBe("true");
      expect((init?.headers as Record<string, string>)["X-Api-Key"]).toBe("k");
      expect(init?.method).toBe("GET");
      return ok({ success: true, results: { entities: [{ entity_id: "x", name: "X" }] } });
    });
    const c = new QlooClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    const { data, meta } = await c.insights({ "filter.type": "urn:entity:place", "feature.explainability": true });
    expect(data.results?.entities?.[0].name).toBe("X");
    expect(meta.attempts).toBe(1);
  });

  it("retries on 429 then succeeds", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => (++n === 1 ? ok({ code: 429 }, 429) : ok({ success: true, results: [] })));
    const c = new QlooClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => {} });
    const { meta } = await c.search({ query: "x" });
    expect(meta.attempts).toBe(2);
  });

  it("classifies 403 as forbidden without retry", async () => {
    const fetchImpl = vi.fn(async () => ok({ message: "nope" }, 403));
    const c = new QlooClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => {} });
    await expect(c.insights({ "filter.type": "urn:entity:place" })).rejects.toMatchObject({ errorClass: "forbidden" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives up after max retries on 500", async () => {
    const fetchImpl = vi.fn(async () => ok({}, 500));
    const c = new QlooClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch, maxRetries: 2, sleep: async () => {} });
    await expect(c.insights({ "filter.type": "urn:entity:place" })).rejects.toMatchObject({ errorClass: "server" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("classifies timeouts", async () => {
    const fetchImpl = vi.fn((_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }),
    );
    const c = new QlooClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 5, maxRetries: 0 });
    await expect(c.search({ query: "x" })).rejects.toMatchObject({ errorClass: "timeout" });
  });

  it("classifies malformed JSON", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>", { status: 200 }));
    const c = new QlooClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(c.search({ query: "x" })).rejects.toMatchObject({ errorClass: "malformed" });
  });

  it("toQuery drops empty values and joins arrays", () => {
    expect(toQuery({ a: "1", b: undefined, c: "", d: ["x", "y"], e: 0 })).toEqual({ a: "1", d: "x,y", e: "0" });
  });
});
