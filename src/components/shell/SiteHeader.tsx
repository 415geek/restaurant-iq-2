import Link from "next/link";
import { getSessionUser } from "@/lib/db/ssr";
import { Button } from "@/components/ui";

export async function SiteHeader() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-xs font-bold text-white">IQ</span>
          <span className="hidden sm:inline">Restaurant IQ</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
          <Button href="/demo" variant="ghost" size="sm">Live demo</Button>
          {user ? (
            <>
              <Button href="/app" variant="ghost" size="sm">My restaurants</Button>
              <form action="/auth/signout" method="post"><Button type="submit" variant="secondary" size="sm">Sign out</Button></form>
            </>
          ) : (
            <Button href="/login" variant="secondary" size="sm">Sign in</Button>
          )}
        </nav>
      </div>
    </header>
  );
}
