import Link from "next/link";
import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { TOOLS_VIEW_LABEL, TOOLS_VIEWS, type ToolsView } from "./tools-view";

/** The demo's segment control, as on HR. */
export function ToolsTabs({ active, t }: { active: ToolsView; t: Translate }) {
  return (
    <div
      role="tablist"
      aria-label="Tools & Forms"
      className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
    >
      {TOOLS_VIEWS.map((view) => (
        <Link
          key={view}
          role="tab"
          aria-selected={view === active}
          href={`/tools?view=${view}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
            view === active
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(TOOLS_VIEW_LABEL[view])}
        </Link>
      ))}
    </div>
  );
}
