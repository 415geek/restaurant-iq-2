import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { FrontNav } from "@/components/front/FrontNav";

export const metadata = { title: "TasteFront", robots: { index: false } };

/** Phone-width shell shared by the owner card (/front) and the HQ fleet view (/front/fleet). */
export default function FrontLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10 pt-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-extrabold tracking-[-0.02em]"><Image src="/brand/logo-mark.svg" alt="" width={24} height={24} />Restaurant IQ <span className="font-semibold text-muted">· TasteFront</span></Link>
        <FrontNav />
      </header>
      {children}
    </main>
  );
}
