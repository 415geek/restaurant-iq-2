import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature, nonceMatches, isFreshLinkTime, parseWebhook, sealTokens, openTokens, passcodeMatches, deviceRef, countByLocalDay } from "@/lib/ring/core";

const KEY = "dGVzdC1obWFjLWtleS1mb3ItcmluZy11bml0LXRlc3Q="; // base64, like the real key
const motion = (sub: string, extra: Record<string, unknown> = {}) => ({
  meta: { version: "1.1", time: "2026-10-28T19:00:00Z", request_id: "req-1", account_id: "ava1.ring.account.ABC" },
  data: { id: "dev9_motion_1793300000000", type: "motion_detected", attributes: { source: "dev9", source_type: "devices", timestamp: 1793300000000, sub_type: sub, ...extra } },
});

describe("ring webhook signature", () => {
  const body = JSON.stringify(motion("human"));
  it("accepts a hex HMAC with sha256= prefix (key used as given)", () => {
    const sig = createHmac("sha256", KEY).update(body).digest("hex");
    expect(verifyWebhookSignature(body, `sha256=${sig}`, KEY)).toBe(true);
  });
  it("accepts the base64-decoded key reading too", () => {
    const sig = createHmac("sha256", Buffer.from(KEY, "base64")).update(body).digest("hex");
    expect(verifyWebhookSignature(body, `sha256=${sig}`, KEY)).toBe(true);
  });
  it("rejects a tampered body, a missing header and garbage", () => {
    const sig = createHmac("sha256", KEY).update(body).digest("hex");
    expect(verifyWebhookSignature(body + " ", `sha256=${sig}`, KEY)).toBe(false);
    expect(verifyWebhookSignature(body, null, KEY)).toBe(false);
    expect(verifyWebhookSignature(body, "sha256=zz", KEY)).toBe(false);
    expect(verifyWebhookSignature(body, `sha256=${sig}`, "")).toBe(false);
  });
});

describe("ring account-link nonce", () => {
  it("matches HMAC(time:account_id) as unpadded url-safe base64", () => {
    const nonce = createHmac("sha256", KEY).update("1793300000000:ava1.ring.account.ABC").digest("base64url");
    expect(nonce).not.toMatch(/[=+/]/);
    expect(nonceMatches(KEY, "1793300000000", "ava1.ring.account.ABC", nonce)).toBe(true);
    expect(nonceMatches(KEY, "1793300000000", "ava1.ring.account.XYZ", nonce)).toBe(false);
    expect(nonceMatches(KEY, "1793300000001", "ava1.ring.account.ABC", nonce)).toBe(false);
  });
  it("accepts links up to 10 minutes old, not older and not from the future", () => {
    const now = 1793300000000;
    expect(isFreshLinkTime(String(now - 599_000), now)).toBe(true);
    expect(isFreshLinkTime(String(now - 601_000), now)).toBe(false);
    expect(isFreshLinkTime(String(now + 120_000), now)).toBe(false);
    expect(isFreshLinkTime("abc", now)).toBe(false);
  });
});

describe("ring webhook parsing keeps only person motion", () => {
  it("keeps human motion as time + hashed device", () => {
    const r = parseWebhook(motion("human"));
    expect(r.kind).toBe("person_motion");
    if (r.kind !== "person_motion") return;
    expect(r.event).toEqual({ requestId: "req-1", accountId: "ava1.ring.account.ABC", occurredAt: new Date(1793300000000).toISOString(), deviceRef: deviceRef("dev9") });
    expect(r.event.deviceRef).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.stringify(r)).not.toContain("dev9");
  });
  it("drops vehicles, packages, plain motion and other events", () => {
    for (const s of ["vehicle", "package_delivery", "other_motion", "motion"]) expect(parseWebhook(motion(s)).kind).toBe("ignored");
    expect(parseWebhook({ meta: { account_id: "a" }, data: { type: "button_press", attributes: {} } }).kind).toBe("ignored");
    expect(parseWebhook(null).kind).toBe("ignored");
    expect(parseWebhook(motion("human", { timestamp: "soon" })).kind).toBe("ignored");
  });
  it("recognises an unlink", () => {
    expect(parseWebhook({ meta: { account_id: "ava1.ring.account.ABC" }, data: { type: "app_integration_removed", attributes: {} } })).toEqual({ kind: "integration_removed", accountId: "ava1.ring.account.ABC" });
  });
});

describe("ring token storage and passcode", () => {
  it("round-trips encrypted tokens and fails with the wrong secret", () => {
    const sealed = sealTokens({ access_token: "acc", refresh_token: "ref" }, "s1");
    expect(sealed).not.toContain("acc");
    expect(openTokens(sealed, "s1")).toEqual({ access_token: "acc", refresh_token: "ref" });
    expect(() => openTokens(sealed, "s2")).toThrow();
  });
  it("compares passcodes and refuses an empty expected value", () => {
    expect(passcodeMatches("abc", "abc")).toBe(true);
    expect(passcodeMatches("abd", "abc")).toBe(false);
    expect(passcodeMatches("", "")).toBe(false);
  });
});

describe("daily counts", () => {
  it("buckets by restaurant-local day", () => {
    const m = countByLocalDay(["2026-10-28T06:30:00Z", "2026-10-28T08:00:00Z"], "America/Los_Angeles");
    expect(m.get("2026-10-27")).toBe(1);
    expect(m.get("2026-10-28")).toBe(1);
  });
});
