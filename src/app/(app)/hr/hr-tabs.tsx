import Link from "next/link";
import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { HR_VIEW_LABEL, HR_VIEWS, type HrView } from "./hr-view";

/** The demo's segment control; each view is its own address. */
export function HrTabs({ active, t }: { active: HrView; t: Translate }) {
  return (
    <div
      role="tablist"
      aria-label="HR"
      className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
    >
      {HR_VIEWS.map((view) => (
        <Link
          key={view}
          role="tab"
          aria-selected={view === active}
          href={`/hr?view=${view}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
            view === active
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(HR_VIEW_LABEL[view])}
        </Link>
      ))}
    </div>
  );
}
