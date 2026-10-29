import { createHmac, createHash, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Ring partner integration, pure helpers (no network, no database).
 * Privacy rule: from every webhook we keep only "a person was detected at time T by device #hash". Nothing else.
 */

export const LINK_MAX_AGE_MS = 600_000;

/** Ring issues the HMAC key as a base64 string. The docs do not say whether to decode it, so both readings are accepted. */
function keyVariants(key: string): Buffer[] {
  const out = [Buffer.from(key, "utf8")];
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(key) && key.length % 4 === 0) out.push(Buffer.from(key, "base64"));
  return out;
}

function safeEq(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** X-Signature: "sha256=<hex HMAC-SHA256 of the raw body>". */
export function verifyWebhookSignature(rawBody: string | Buffer, header: string | null, key: string): boolean {
  if (!header || !key) return false;
  const hex = header.trim().replace(/^sha256=/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) return false;
  const got = Buffer.from(hex, "hex");
  return keyVariants(key).some((k) => safeEq(createHmac("sha256", k).update(rawBody).digest(), got));
}

/** Account-link nonce: URL-safe base64 (no padding) of HMAC-SHA256("<time>:<account_id>"). */
export function linkNonces(key: string, time: string, accountId: string): string[] {
  return keyVariants(key).map((k) => createHmac("sha256", k).update(`${time}:${accountId}`).digest("base64url"));
}

export function nonceMatches(key: string, time: string, accountId: string, nonce: string): boolean {
  const n = Buffer.from(nonce);
  return linkNonces(key, time, accountId).some((x) => safeEq(Buffer.from(x), n));
}

/** time is epoch milliseconds; reject anything older than 10 minutes or from the future (1 minute clock skew allowed). */
export function isFreshLinkTime(time: string, now = Date.now()): boolean {
  if (!/^\d{12,14}$/.test(time)) return false;
  const t = Number(time);
  return t <= now + 60_000 && now - t <= LINK_MAX_AGE_MS;
}

export function deviceRef(deviceId: string): string {
  return createHash("sha256").update(`ring-device:${deviceId}`).digest("hex").slice(0, 12);
}

export type PersonMotion = { requestId: string; accountId: string; occurredAt: string; deviceRef: string };
export type WebhookParse =
  | { kind: "person_motion"; event: PersonMotion }
  | { kind: "integration_removed"; accountId: string }
  | { kind: "ignored"; reason: string };

type Envelope = {
  meta?: { request_id?: unknown; account_id?: unknown; time?: unknown };
  data?: { type?: unknown; attributes?: { source?: unknown; timestamp?: unknown; sub_type?: unknown } };
};

/** Only person motion (Smart Alerts sub_type "human") is kept. Vehicles, packages, plain motion and everything else are dropped. */
export function parseWebhook(payload: unknown): WebhookParse {
  const p = (payload ?? {}) as Envelope;
  const type = typeof p.data?.type === "string" ? p.data.type : "";
  const accountId = typeof p.meta?.account_id === "string" ? p.meta.account_id : "";
  if (type === "app_integration_removed" && accountId) return { kind: "integration_removed", accountId };
  if (type !== "motion_detected") return { kind: "ignored", reason: `type:${type || "unknown"}` };
  const a = p.data?.attributes ?? {};
  if (a.sub_type !== "human") return { kind: "ignored", reason: `sub_type:${String(a.sub_type ?? "none")}` };
  const requestId = typeof p.meta?.request_id === "string" ? p.meta.request_id : "";
  const source = typeof a.source === "string" || typeof a.source === "number" ? String(a.source) : "";
  const ts = typeof a.timestamp === "number" ? a.timestamp : typeof a.timestamp === "string" && /^\d+$/.test(a.timestamp) ? Number(a.timestamp) : NaN;
  if (!requestId || !accountId || !source || !Number.isFinite(ts) || ts < 1_500_000_000_000) return { kind: "ignored", reason: "malformed" };
  return { kind: "person_motion", event: { requestId: requestId.slice(0, 200), accountId, occurredAt: new Date(ts).toISOString(), deviceRef: deviceRef(source) } };
}

/** Tokens at rest: AES-256-GCM with a key derived from the client secret. */
function aesKey(secret: string): Buffer {
  return createHash("sha256").update(`ring-token-at-rest:${secret}`).digest();
}

export function sealTokens(tokens: { access_token: string; refresh_token: string }, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", aesKey(secret), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(tokens), "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function openTokens(sealed: string, secret: string): { access_token: string; refresh_token: string } {
  const [v, iv, tag, enc] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("bad token envelope");
  const d = createDecipheriv("aes-256-gcm", aesKey(secret), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8"));
}

export function passcodeMatches(given: string, expected: string): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Daily counts in a time zone, for the evidence card. */
export function countByLocalDay(times: string[], tz: string): Map<string, number> {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const m = new Map<string, number>();
  for (const t of times) {
    const k = fmt.format(new Date(t));
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
