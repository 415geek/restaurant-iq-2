import Link from "next/link";
import { cx } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";

export type StepKey = "snapshot" | "signals" | "choose" | "decide" | "act";
const ORDER: StepKey[] = ["snapshot", "signals", "choose", "decide", "act"];

/** Five-step journey bar. `done` steps are green, `current` is coral. */
export function StepBar({ current, labels, hrefs }: { current: StepKey; labels: Record<StepKey, string>; hrefs: Partial<Record<StepKey, string>> }) {
  const ci = ORDER.indexOf(current);
  return (
    <div className="scroll-x -mx-4 min-w-0 overflow-x-auto px-4 sm:mx-0 sm:px-0">
    <ol className="flex w-max gap-1.5" aria-label="Progress">
      {ORDER.map((k, i) => {
        const state = i < ci ? "done" : i === ci ? "on" : "todo";
        const cls = cx("flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold", state === "on" ? "border-coral bg-coral text-white" : state === "done" ? "border-border bg-surface text-good-ink" : "border-border bg-surface text-muted");
        const inner = (<><span className={cx("grid h-5 w-5 place-items-center rounded-full text-[11px]", state === "on" ? "bg-white/25 text-white" : state === "done" ? "bg-good-soft text-good-ink" : "bg-surface-2 text-muted")}>{state === "done" ? <Icon.check width={12} height={12} /> : i + 1}</span>{labels[k]}</>);
        const href = hrefs[k];
        return <li key={k}>{href ? <Link href={href} className={cls} aria-current={state === "on" ? "step" : undefined}>{inner}</Link> : <span className={cls}>{inner}</span>}</li>;
      })}
    </ol>
    </div>
  );
}
