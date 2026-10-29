import { RingLinkForm } from "@/components/ring/RingLinkForm";
import { isFreshLinkTime } from "@/lib/ring/core";
import { ringConfig } from "@/lib/ring/server";

export const dynamic = "force-dynamic";

/** Ring "Account Link URL". Ring redirects here with ?nonce=&time= after the owner authorizes in the Ring app. */
export default async function RingLinkPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const nonce = typeof sp.nonce === "string" ? sp.nonce : "";
  const time = typeof sp.time === "string" ? sp.time : "";
  const on = ringConfig() !== null;
  const fresh = isFreshLinkTime(time);
  return (
    <div className="grid gap-4">
      <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em]">Connect Ring to Restaurant IQ</h1>
      <p className="text-[14px] text-ink-2">Restaurant IQ will receive <b>person-detected events only</b> (time of day, no video, no snapshots, no audio) from your Ring devices and show them beside your TastePass results.</p>
      {!on ? <p className="rounded-xl bg-warn-soft px-3 py-2 text-[13px] font-semibold text-warn-ink" role="alert">The Ring integration is not enabled on this deployment.</p>
        : !nonce || !fresh ? <p className="rounded-xl bg-warn-soft px-3 py-2 text-[13px] font-semibold text-warn-ink" role="alert" data-testid="ring-link-expired">This link has expired or is incomplete. Start again from the Ring app (links are valid for 10 minutes).</p>
        : <RingLinkForm nonce={nonce} time={time} />}
    </div>
  );
}
