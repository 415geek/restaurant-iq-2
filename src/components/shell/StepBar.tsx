import Link from "next/link";
import { cx } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";

/** Page-level position in the journey. Pages pass these keys; the bar shows them as four execution stages. */
export type StepKey = "snapshot" | "signals" | "choose" | "decide" | "act" | "prove";
export type Stage = "signals" | "recommend" | "execute" | "prove";
const STAGES: Array<{ stage: Stage; keys: StepKey[] }> = [
  { stage: "signals", keys: ["signals", "snapshot"] },
  { stage: "recommend", keys: ["choose", "decide"] },
  { stage: "execute", keys: ["act"] },
  { stage: "prove", keys: ["prove"] },
];

/** Four-stage bar: Signals → Recommend → Execute (owner-approved TastePass) → Prove. `done` stages are green, the current one coral. */
export function StepBar({ current, labels, hrefs }: { current: StepKey; labels: Record<Stage, string>; hrefs: Partial<Record<StepKey, string>> }) {
  const ci = STAGES.findIndex((s) => s.keys.includes(current));
  return (
    <div className="scroll-x -mx-4 min-w-0 overflow-x-auto px-4 sm:mx-0 sm:px-0">
    <ol className="flex w-max items-center gap-1.5" aria-label="Progress">
      {STAGES.map(({ stage, keys }, i) => {
        const state = i < ci ? "done" : i === ci ? "on" : "todo";
        const cls = cx("flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold", state === "on" ? "border-coral bg-coral text-white" : state === "done" ? "border-border bg-surface text-good-ink" : "border-border bg-surface text-muted");
        const inner = (<><span className={cx("grid h-5 w-5 place-items-center rounded-full text-[11px]", state === "on" ? "bg-white/25 text-white" : state === "done" ? "bg-good-soft text-good-ink" : "bg-surface-2 text-muted")}>{state === "done" ? <Icon.check width={12} height={12} /> : i + 1}</span>{labels[stage]}</>);
        const href = state === "on" ? undefined : keys.map((k) => hrefs[k]).find(Boolean);
        return <li key={stage} className="flex items-center gap-1.5">{i > 0 ? <span aria-hidden className="text-muted">→</span> : null}{href ? <Link href={href} className={cls}>{inner}</Link> : <span className={cls} aria-current={state === "on" ? "step" : undefined}>{inner}</span>}</li>;
      })}
    </ol>
    </div>
  );
}
