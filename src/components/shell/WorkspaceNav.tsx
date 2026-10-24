"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  { seg: "", label: "Snapshot" },
  { seg: "taste", label: "Taste signals" },
  { seg: "opportunities", label: "Opportunities" },
  { seg: "actions", label: "Action board" },
  { seg: "memory", label: "Business memory" },
];

export function WorkspaceNav({ base }: { base: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Workspace" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {TABS.map((t) => {
          const href = t.seg ? `${base}/${t.seg}` : base;
          const active = t.seg ? path.startsWith(href) : path === base;
          return (
            <li key={t.seg}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cx("block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm", active ? "border-accent font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink")}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
