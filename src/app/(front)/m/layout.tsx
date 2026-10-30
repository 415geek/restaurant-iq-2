import type { ReactNode } from "react";

export const metadata = { robots: { index: false } };

/** Public customer menu: phone-width, no app chrome, no PII, no checkout. */
export default function PublicMenuLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10 pt-4">{children}</main>;
}
