import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import type { TaskBanner } from "./task-view";

const TONE = {
  bad: "bg-bad-bg text-bad",
  warn: "bg-warn-bg text-warn",
} as const;

export function TaskBannerLine({
  banner,
  t,
}: {
  banner: TaskBanner;
  t: Translate;
}) {
  return (
    <p className={cn("rounded-xl px-4 py-3 text-sm", TONE[banner.tone])}>
      <b>{t("Tasks")}:</b> {banner.parts.join(" · ")}
    </p>
  );
}
