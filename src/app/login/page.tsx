import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionUser } from "@/lib/db/ssr";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/app";
  if (await getSessionUser()) redirect(next);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        {sp.error ? <p className="mx-auto mb-4 max-w-md text-sm text-bad" role="alert">That sign-in link was invalid or expired. Request a new one.</p> : null}
        <LoginForm next={next} />
      </main>
    </>
  );
}
