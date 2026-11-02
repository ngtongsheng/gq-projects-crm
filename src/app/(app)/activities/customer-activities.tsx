import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDateTime } from "@/lib/format/date";
import { ActivityActions } from "./activity-actions";
import { activityStatusTone } from "./activity-status-tone";
import {
  type ActivityStatus,
  ActivityStatusLabel,
  type ActivityType,
  ActivityTypeLabel,
} from "./schemas";

export type CustomerActivity = {
  id: string;
  ownerName: string;
  type: ActivityType;
  purpose: string;
  outcome: string | null;
  startsAt: string;
  status: ActivityStatus;
  canEdit: boolean;
};

type CustomerActivitiesProps = {
  contactId: string;
  customerName: string;
  activities: CustomerActivity[];
};

/** Newest first, as the caller sorts them. */
export function CustomerActivities({
  contactId,
  customerName,
  activities,
}: CustomerActivitiesProps) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No activities yet"
        description="Visits, calls and meetings with this customer will show here."
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y">
      {activities.map((activity) => (
        <li
          key={activity.id}
          className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm tabular-nums">
                {formatDateTime(activity.startsAt)}
              </span>
              <StatusBadge tone={activityStatusTone[activity.status]}>
                {ActivityStatusLabel[activity.status]}
              </StatusBadge>
            </div>
            <p className="text-sm">
              <span className="font-medium">
                {ActivityTypeLabel[activity.type]}
              </span>{" "}
              · {activity.purpose}
            </p>
            {activity.outcome && (
              <p className="text-sm text-muted-foreground">
                {activity.outcome}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {activity.ownerName}
            </p>
          </div>
          {activity.canEdit && (
            <ActivityActions
              contactId={contactId}
              customerName={customerName}
              activity={{
                id: activity.id,
                type: activity.type,
                purpose: activity.purpose,
                outcome: activity.outcome ?? "",
                startsAt: activity.startsAt,
                status: activity.status,
              }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
