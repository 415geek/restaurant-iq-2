import "server-only";
import { getSsrClient } from "@/lib/db/ssr";
import type { Access } from "@/lib/auth/authorize";

/** Same policy as restaurants: members write; the demo tenant is writable by anyone, rate-limited; everything else is invisible. */
export async function authorizeOrg(organizationId: string): Promise<Access> {
  const supabase = await getSsrClient();
  const { data: user } = await supabase.auth.getUser();
  const { data: org } = await supabase.from("organizations").select("id, is_demo").eq("id", organizationId).maybeSingle();
  if (!org) return { kind: "none" };
  if (user.user) {
    const { data: m } = await supabase.from("organization_memberships").select("organization_id").eq("organization_id", organizationId).eq("user_id", user.user.id).maybeSingle();
    if (m) return { kind: "member", userId: user.user.id, organizationId };
  }
  if (org.is_demo) return { kind: "demo", userId: user.user?.id ?? null };
  return { kind: "none" };
}
