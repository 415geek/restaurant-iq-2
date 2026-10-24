import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cookie-bound Supabase client for Server Components / Route Handlers (RLS enforced as the signed-in user or anon). */
export async function getSsrClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component: cookies are refreshed by middleware instead
        }
      },
    },
  });
}

export async function getSessionUser() {
  const supabase = await getSsrClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
