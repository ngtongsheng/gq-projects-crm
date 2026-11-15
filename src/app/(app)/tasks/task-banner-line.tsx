import { cn } from "@/lib/utils";
import type { TaskBanner } from "./task-view";

const TONE = {
  bad: "bg-bad-bg text-bad",
  warn: "bg-warn-bg text-warn",
} as const;

export function TaskBannerLine({ banner }: { banner: TaskBanner }) {
  return (
    <p className={cn("rounded-xl px-4 py-3 text-sm", TONE[banner.tone])}>
      <b>Tasks:</b> {banner.parts.join(" · ")}
    </p>
  );
}
