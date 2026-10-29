import { Card } from "@/components/ui";
import { ringConfig } from "@/lib/ring/server";

export const dynamic = "force-dynamic";

/** Ring "App Homepage URL": what the integration does, what it stores, and how to turn it off. */
export default function RingHome() {
  const on = ringConfig() !== null;
  return (
    <div className="grid gap-4">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">Your entrance camera, as one more signal for your restaurant</h1>
      <p className="text-[14px] text-ink-2">Restaurant IQ turns cultural taste data into small, owner-approved offers (TastePass) and checks what happened afterwards. With Ring connected, the result page also shows how many times a person was detected at your entrance during the offer, next to redemptions and sales.</p>
      <Card>
        <h2 className="mb-2 text-[15px] font-bold">What we keep</h2>
        <ul className="grid list-disc gap-1.5 pl-5 text-[13.5px] text-ink-2">
          <li>Only <b>person-detected</b> motion events (Ring Smart Alerts). Vehicles, packages, doorbell presses and plain motion are dropped.</li>
          <li>For each event: the time, and a scrambled device reference. Nothing else.</li>
          <li><b>No video, no snapshots, no audio, no live view.</b> We never request them.</li>
          <li>Your Ring name, email and phone number are never read or stored.</li>
        </ul>
      </Card>
      <Card>
        <h2 className="mb-2 text-[15px] font-bold">What it means, and what it does not</h2>
        <p className="text-[13.5px] text-ink-2">A person event is not a guest count. One guest can trigger several, and staff and passers-by trigger them too. We show it as a trend beside redemptions and sales, never as foot traffic or revenue.</p>
      </Card>
      <Card>
        <h2 className="mb-2 text-[15px] font-bold">Connect or disconnect</h2>
        <p className="text-[13.5px] text-ink-2">Connect from the Ring app (Control Center → Third-party apps → Restaurant IQ). You will be asked for your Restaurant IQ link passcode. To disconnect, remove Restaurant IQ in the Ring app: we stop accepting events immediately and delete the access tokens.</p>
      </Card>
      <p className="text-[12px] text-muted" data-testid="ring-status">{on ? "Integration status: available." : "Integration status: not enabled on this deployment."}</p>
    </div>
  );
}
