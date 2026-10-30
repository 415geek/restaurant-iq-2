import { describe, expect, it } from "vitest";
import { buildSocialPost, buildSocialPosts, hashtagsFor, PLATFORMS } from "@/lib/business/social";

const input = {
  restaurant: { name: "Chuan Lane", neighborhood: "San Bruno", city: "San Bruno", cuisine: "Sichuan" },
  offer: { name: "Block party special", menuItem: "Dan Dan Noodles", offerPrice: 9.5, regularPrice: 12, endsAt: "2026-11-08T07:00:00Z", maxRedemptions: 30 },
  moment: { name: "Mills Park Block Party", date: "2026-11-07" },
  url: "https://restaurant-iq-2.vercel.app/p/abc123",
};

describe("social copy", () => {
  it("keeps price, cap, link and moment in every platform", () => {
    for (const p of buildSocialPosts(input)) {
      expect(p.text).toContain("$9.50"); expect(p.text).toContain("$12"); expect(p.text).toContain("30"); expect(p.text).toContain(input.url); expect(p.text).toContain("Mills Park Block Party");
      expect(p.text.length).toBeLessThanOrEqual(p.limit);
    }
  });
  it("defaults Chinese platforms to Chinese and western ones to English", () => {
    const posts = buildSocialPosts(input);
    expect(posts.find((p) => p.platform === "xiaohongshu")?.lang).toBe("zh");
    expect(posts.find((p) => p.platform === "instagram")?.lang).toBe("en");
    expect(posts.find((p) => p.platform === "xiaohongshu")?.text).toContain("领券");
    expect(PLATFORMS.length).toBe(5);
  });
  it("drops the moment line when the pass is not timed", () => {
    const p = buildSocialPost("facebook", "es", { ...input, moment: null });
    expect(p.text).not.toContain("Mills Park"); expect(p.text).toContain("Consigue tu pase");
    expect(p.shareHref).toContain("facebook.com/sharer");
  });
  it("builds hashtags without spaces or punctuation", () => {
    expect(hashtagsFor(input, "en")).toEqual(["#SanBrunoEats", "#SanBrunoFood", "#SichuanFood", "#BayAreaEats", "#ChuanLane"]);
    for (const h of hashtagsFor(input, "zh")) expect(h).toMatch(/^#[^\s#]+$/u);
  });
});
