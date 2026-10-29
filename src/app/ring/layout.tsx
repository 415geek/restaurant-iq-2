import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Restaurant IQ for Ring", robots: { index: false } };

export default function RingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10 pt-4">
      <header className="mb-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-extrabold tracking-[-0.02em]"><Image src="/brand/logo-mark.svg" alt="" width={24} height={24} />Restaurant IQ</Link>
        <span className="text-[12px] font-semibold text-muted">Ring integration</span>
      </header>
      {children}
    </main>
  );
}
