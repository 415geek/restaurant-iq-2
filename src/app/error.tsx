"use client";
import { Button } from "@/components/ui";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-ink-2">The page failed to render. Nothing was changed. You can retry or go back to the demo.</p>
      <div className="mt-6 flex justify-center gap-3"><Button onClick={reset}>Retry</Button><Button href="/demo" variant="secondary">Demo</Button></div>
    </main>
  );
}
