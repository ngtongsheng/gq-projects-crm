import { StatusBadge } from "@/components/app/status-badge";
import type { LogStatus } from "@/lib/domain/site-log-status";
import { formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";

/** A measurement or photos status as one badge: the phrase, then who and when. */
export function LogStatusBadge({
  status,
  t,
}: {
  status: LogStatus;
  t: Translate;
}) {
  return (
    <StatusBadge tone={status.tone}>
      {[t(status.text), status.who, status.on && formatDate(status.on)]
        .filter(Boolean)
        .join(" ")}
    </StatusBadge>
  );
}
