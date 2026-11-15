import Link from "next/link";
import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { TASK_VIEW_LABEL, type TaskView } from "./task-view";

/** The demo's tab strip; each tab is its own address so the list survives a reload. */
export function TasksTabs({
  views,
  active,
  counts,
  t,
}: {
  t: Translate;
  views: TaskView[];
  active: TaskView;
  /** Open tasks shown beside a tab's name. */
  counts: Partial<Record<TaskView, number>>;
}) {
  return (
    <div
      role="tablist"
      aria-label={t("Tasks")}
      className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
    >
      {views.map((view) => (
        <Link
          key={view}
          role="tab"
          aria-selected={view === active}
          href={`/tasks?view=${view}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
            view === active
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(TASK_VIEW_LABEL[view])}
          {counts[view] !== undefined && (
            <span className="font-mono tabular-nums"> ({counts[view]})</span>
          )}
        </Link>
      ))}
    </div>
  );
}
