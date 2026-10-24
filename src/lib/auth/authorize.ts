import "server-only";
import { getSsrClient } from "@/lib/db/ssr";

export type Access =
  | { kind: "member"; userId: string; organizationId: string }
  | { kind: "demo"; userId: string | null }
  | { kind: "none" };

/**
 * Decide how the current request may act on a restaurant.
 * Reads go through RLS (so a demo restaurant is readable by anyone, a private one only by members).
 * Writes: members write via the service role after this check; demo writes are allowed but rate-limited.
 */
export async function authorizeRestaurant(restaurantId: string): Promise<Access> {
  const supabase = await getSsrClient();
  const { data: user } = await supabase.auth.getUser();
  const { data: r } = await supabase
    .from("restaurants")
    .select("id, organization_id, organizations!inner(is_demo)")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!r) return { kind: "none" };
  const org = (r as unknown as { organizations: { is_demo: boolean } | null }).organizations;
  if (user.user) {
    const { data: m } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("organization_id", r.organization_id)
      .eq("user_id", user.user.id)
      .maybeSingle();
    if (m) return { kind: "member", userId: user.user.id, organizationId: r.organization_id };
  }
  if (org?.is_demo) return { kind: "demo", userId: user.user?.id ?? null };
  return { kind: "none" };
}

export function actorLabel(access: Access): string {
  if (access.kind === "member") return `user:${access.userId}`;
  if (access.kind === "demo") return access.userId ? `demo-user:${access.userId}` : "demo-visitor";
  return "anonymous";
}
