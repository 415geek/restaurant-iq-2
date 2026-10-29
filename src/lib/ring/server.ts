import "server-only";

export const RING_OAUTH = "https://oauth.ring.com/oauth/token";
export const RING_API = "https://api.amazonvision.com";
const TIMEOUT_MS = 8_000;

export type RingConfig = { clientId: string; clientSecret: string; hmacKey: string; passcode: string };

/** Ring is off unless all credentials are present and RING_ENABLED=1. Routes 404 when off. */
export function ringConfig(): RingConfig | null {
  const c = {
    clientId: process.env.RING_CLIENT_ID ?? "",
    clientSecret: process.env.RING_CLIENT_SECRET ?? "",
    hmacKey: process.env.RING_HMAC_KEY ?? "",
    passcode: process.env.RING_LINK_PASSCODE ?? "",
  };
  if (process.env.RING_ENABLED !== "1" || !c.clientId || !c.clientSecret || !c.hmacKey || !c.passcode) return null;
  return c;
}

async function call(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
}

export async function exchangeCode(cfg: RingConfig, code: string) {
  const body = new URLSearchParams({ grant_type: "authorization_code", client_id: cfg.clientId, client_secret: cfg.clientSecret, code });
  const r = await call(RING_OAUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error(`ring token exchange ${r.status}`);
  const j = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!j.access_token || !j.refresh_token) throw new Error("ring token exchange: missing tokens");
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_in: j.expires_in ?? 14400 };
}

export async function fetchAccountId(accessToken: string): Promise<string> {
  const r = await call(`${RING_API}/v1/users/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`ring users/me ${r.status}`);
  const j = (await r.json()) as { data?: { id?: string } };
  if (!j.data?.id) throw new Error("ring users/me: no id");
  return j.data.id; // the profile fields (name, email, phone) are never read or stored
}

/** Step 2 + 3 of Ring-initiated linking: register the integration with the nonce, then mark it completed. */
export async function completeLink(accessToken: string, accountIdentifier: string, nonce: string): Promise<void> {
  const url = `${RING_API}/v1/accounts/me/app-integrations`;
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const post = await call(url, { method: "POST", headers, body: JSON.stringify({ account_identifier: accountIdentifier, nonce }) });
  if (!post.ok && post.status !== 409) throw new Error(`ring app-integrations POST ${post.status}`);
  const patch = await call(url, { method: "PATCH", headers, body: JSON.stringify({ status: "completed" }) });
  if (!patch.ok) throw new Error(`ring app-integrations PATCH ${patch.status}`);
}
