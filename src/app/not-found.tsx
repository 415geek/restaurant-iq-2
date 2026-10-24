import { SiteHeader } from "@/components/shell/SiteHeader";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-20 text-center">
        <h1 className="text-3xl font-semibold">Not found</h1>
        <p className="mt-2 text-ink-2">That restaurant or page does not exist, or you do not have access to it.</p>
        <div className="mt-6 flex justify-center gap-3"><Button href="/demo">Open the demo</Button><Button href="/" variant="secondary">Home</Button></div>
      </main>
    </>
  );
}
