import { cx } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";

/** TasteFront's four stages: Taste (agent read the neighborhood) → Rewrite (draft version) → Publish (live) → Prove (settled against a holdout). */
export type FrontStage = "taste" | "rewrite" | "publish" | "prove";
export const FRONT_STAGES: FrontStage[] = ["taste", "rewrite", "publish", "prove"];

/** Same look as the workspace StepBar: done = green check, current = coral, upcoming = muted. Scrolls sideways on phones. */
export function FrontStepBar({ current, labels }: { current: FrontStage; labels: Record<FrontStage, string> }) {
  const ci = FRONT_STAGES.indexOf(current);
  return (
    <div className="scroll-x -mx-4 min-w-0 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ol className="flex w-max items-center gap-1 pr-4 sm:pr-0" aria-label="Progress" data-testid="front-steps">
        {FRONT_STAGES.map((stage, i) => {
          const state = i < ci ? "done" : i === ci ? "on" : "todo";
          const cls = cx("flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12.5px] font-semibold", state === "on" ? "border-coral bg-coral text-white" : state === "done" ? "border-border bg-surface text-good-ink" : "border-border bg-surface text-muted");
          return (
            <li key={stage} className="flex items-center gap-1">
              {i > 0 ? <span aria-hidden className="text-muted">→</span> : null}
              <span className={cls} aria-current={state === "on" ? "step" : undefined}>
                <span className={cx("grid h-[18px] w-[18px] place-items-center rounded-full text-[10.5px]", state === "on" ? "bg-white/25 text-white" : state === "done" ? "bg-good-soft text-good-ink" : "bg-surface-2 text-muted")}>{state === "done" ? <Icon.check width={12} height={12} /> : i + 1}</span>
                {labels[stage]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
