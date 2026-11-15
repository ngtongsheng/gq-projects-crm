import type { SiteActivity } from "@/lib/domain/site-log";
import type { CalendarDate } from "@/lib/format/date";

/**
 * The Log work wizard's address (`/today/log`): the day, and what is already known about the
 * site and activity when it is opened from a planned job or a missed day.
 */
export function recordHref(
  day: CalendarDate,
  preset: {
    mofId?: string | null;
    projectId?: string | null;
    siteName?: string | null;
    activity?: SiteActivity;
  } = {},
): string {
  const params = new URLSearchParams({ date: day });
  if (preset.mofId) params.set("mof", preset.mofId);
  if (preset.projectId) params.set("project", preset.projectId);
  if (preset.siteName) params.set("site", preset.siteName);
  if (preset.activity) params.set("activity", preset.activity);
  return `/today/log?${params}`;
}
