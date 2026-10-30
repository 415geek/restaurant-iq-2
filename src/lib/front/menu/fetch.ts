import "server-only";
import { extractTextFromHtml, parseMenuText, type ParsedItem } from "./parse";

/**
 * Fetch a public menu page and parse it. The URL is owner-supplied and therefore untrusted: only http(s), no loopback /
 * private / link-local hosts (checked again on every redirect hop), 10 s timeout, 2 MB cap, HTML or plain text only.
 * The page text is data — it goes through extractTextFromHtml → parseMenuText and never into a system prompt.
 */
export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export class MenuFetchError extends Error {
  constructor(public readonly reason: "bad_url" | "blocked_host" | "timeout" | "too_large" | "bad_content_type" | "http" | "network" | "empty", message: string) { super(message); this.name = "MenuFetchError"; }
}

const BLOCKED_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home|.*\.lan|ip6-localhost|0\.0\.0\.0|\[?::1?\]?)$/i;
function isPrivateIpv4(h: string): boolean {
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
function isPrivateIpv6(h: string): boolean {
  const s = h.replace(/^\[|\]$/g, "").toLowerCase();
  if (!s.includes(":")) return false;
  if (s === "::" || s === "::1") return true;
  if (/^f[cd]/.test(s) || /^fe[89ab]/.test(s)) return true; // fc00::/7 unique-local, fe80::/10 link-local
  const v4 = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
  return v4 ? isPrivateIpv4(v4[1]) : false;
}

/** Throws MenuFetchError for anything that is not a public http(s) URL. Exported so the route can validate before queuing work. */
export function assertSafeMenuUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new MenuFetchError("bad_url", "Enter a full web address, e.g. https://example.com/menu"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new MenuFetchError("bad_url", "Only http(s) links are supported");
  if (u.username || u.password) throw new MenuFetchError("bad_url", "Links with embedded credentials are not supported");
  const host = u.hostname.toLowerCase();
  if (!host || BLOCKED_HOST.test(host) || isPrivateIpv4(host) || isPrivateIpv6(host) || /^\d+$/.test(host) || /^0x/i.test(host)) {
    throw new MenuFetchError("blocked_host", "That address points at a private or local network and cannot be fetched");
  }
  return u;
}

async function readCapped(res: Response): Promise<string> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new MenuFetchError("too_large", "The page is larger than 2 MB");
  if (!res.body || typeof res.body.getReader !== "function") {
    const t = await res.text();
    if (Buffer.byteLength(t, "utf8") > MAX_BODY_BYTES) throw new MenuFetchError("too_large", "The page is larger than 2 MB");
    return t;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) { await reader.cancel().catch(() => undefined); throw new MenuFetchError("too_large", "The page is larger than 2 MB"); }
      chunks.push(value);
    }
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

export async function fetchMenuFromUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<{ items: ParsedItem[]; warnings: string[]; source: "url" }> {
  let target = assertSafeMenuUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      try {
        res = await fetchImpl(target.toString(), {
          method: "GET", redirect: "manual", signal: controller.signal,
          headers: { accept: "text/html, text/plain;q=0.9, */*;q=0.1", "user-agent": "RestaurantIQ-TasteFront/1.0 (+menu import)" },
        });
      } catch (e) {
        if (controller.signal.aborted) throw new MenuFetchError("timeout", "The page took longer than 10 s to respond");
        throw new MenuFetchError("network", `Could not reach ${target.hostname}: ${e instanceof Error ? e.message : "network error"}`);
      }
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || hop === MAX_REDIRECTS) throw new MenuFetchError("http", "Too many redirects");
        target = assertSafeMenuUrl(new URL(loc, target).toString()); // every hop is re-validated: no redirect into the private network
        res = null;
        continue;
      }
      break;
    }
    if (!res) throw new MenuFetchError("http", "No response");
    if (!res.ok) throw new MenuFetchError("http", `The page returned HTTP ${res.status}`);
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct && !/^(text\/html|text\/plain|application\/xhtml\+xml)/.test(ct)) throw new MenuFetchError("bad_content_type", `Expected a web page, got ${ct.split(";")[0]}`);
    const body = await readCapped(res);
    const text = /^text\/plain/.test(ct) ? body : extractTextFromHtml(body);
    if (!text.trim()) throw new MenuFetchError("empty", "The page has no readable text (it may render its menu with JavaScript or as images)");
    const parsed = parseMenuText(text);
    return { items: parsed.items, warnings: [`Fetched from ${target.hostname}`, ...parsed.warnings], source: "url" };
  } finally {
    clearTimeout(timer);
  }
}
