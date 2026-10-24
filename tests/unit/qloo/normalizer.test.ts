import { describe, it, expect } from "vitest";
import {
  affinityLabel,
  normalizeDemographics,
  normalizeHeatmap,
  normalizeInsightEntities,
  normalizeSearchEntities,
  normalizeTags,
} from "@/lib/providers/qloo/normalizer";

describe("normalizer", () => {
  it("keeps affinity undefined when the API did not supply it (never invents)", () => {
    const out = normalizeInsightEntities({
      results: { entities: [{ entity_id: "a", name: "A", subtype: "urn:entity:place", popularity: 0.5, tags: [{ id: "urn:tag:x", name: "X" }] }] },
    });
    expect(out).toHaveLength(1);
    expect(out[0].affinity).toBeUndefined();
    expect(out[0].domain).toBe("place");
    expect(out[0].tags[0].id).toBe("urn:tag:x");
  });

  it("reads query.affinity and explainability when present", () => {
    const out = normalizeInsightEntities({
      results: {
        entities: [
          {
            entity_id: "a",
            name: "A",
            subtype: "urn:entity:brand",
            query: { affinity: 0.91, explainability: { "urn:tag:genre:place:restaurant:taiwanese": 0.6, junk: "x" } },
            properties: { geocode: { city: "San Francisco" }, price_level: 2, image: { url: "https://img" } },
          },
        ],
      },
    });
    expect(out[0].affinity).toBe(0.91);
    expect(out[0].explainability).toEqual({ "urn:tag:genre:place:restaurant:taiwanese": 0.6 });
    expect(out[0].properties.city).toBe("San Francisco");
    expect(out[0].properties.priceLevel).toBe(2);
    expect(out[0].properties.imageUrl).toBe("https://img");
  });

  it("drops entities without id or name", () => {
    expect(normalizeInsightEntities({ results: { entities: [{ name: "no id" }, { entity_id: "x" }] } })).toEqual([]);
    expect(normalizeSearchEntities({ results: [{ name: "no id" }] })).toEqual([]);
  });

  it("normalizes demographics buckets and ignores unknown keys", () => {
    const out = normalizeDemographics({
      results: { demographics: [{ entity_id: "t", query: { age: { "25_to_29": 0.4, bogus: 1 }, gender: { male: -0.1, female: 0.1 } } }] },
    });
    expect(out[0].age).toEqual({ "25_to_29": 0.4 });
    expect(out[0].gender).toEqual({ male: -0.1, female: 0.1 });
  });

  it("normalizes tags using tag_id and heatmap cells", () => {
    expect(normalizeTags({ results: { tags: [{ tag_id: "urn:tag:a", name: "A", subtype: "urn:tag:x" }] } })[0]).toMatchObject({ tagId: "urn:tag:a", name: "A" });
    const cells = normalizeHeatmap({ results: { heatmap: [{ location: { latitude: 1, longitude: 2, geohash: "g" }, query: { affinity: 1, affinity_rank: 0.9, popularity: 0.5 } }, { location: {} }] } });
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ lat: 1, lon: 2, affinity: 1 });
  });

  it("labels affinity without percentages", () => {
    expect(affinityLabel(undefined)).toBe("unknown");
    expect(affinityLabel(0.85)).toBe("strong");
    expect(affinityLabel(0.6)).toBe("moderate");
    expect(affinityLabel(0.1)).toBe("weak");
  });
});
