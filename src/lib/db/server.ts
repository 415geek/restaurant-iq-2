import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | undefined;

/** Service-role client. Server only. Bypasses RLS: use exclusively inside trusted server code paths. */
export function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service credentials are not configured");
  serviceClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return serviceClient;
}

export function hasServiceCredentials(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
