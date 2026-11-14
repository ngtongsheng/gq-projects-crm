"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setActivityStatus } from "./actions";
import { ActivityDialog, type EditableActivity } from "./activity-form";
import { LogOutcomeDialog } from "./log-outcome-dialog";
import { ActivityTypeLabel } from "./schemas";

type ActivityActionsProps = {
  contactId: string;
  customerName: string;
  activity: EditableActivity;
  needsOutcome: boolean;
};

/** Edit for the owner; log the outcome once a planned activity's time has come, or cancel it. */
export function ActivityActions({
  contactId,
  customerName,
  activity,
  needsOutcome,
}: ActivityActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    startTransition(async () => {
      const result = await setActivityStatus(activity.id, "cancelled");
      setError(result.error);
      if (!result.error) toast.success("Activity cancelled.");
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {activity.status === "planned" && (
          <>
            {needsOutcome && (
              <LogOutcomeDialog
                activityId={activity.id}
                summary={`${customerName} · ${ActivityTypeLabel[activity.type]} · ${activity.purpose}`}
              />
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={cancel}
            >
              Cancel
            </Button>
          </>
        )}
        <ActivityDialog
          contactId={contactId}
          customerName={customerName}
          activity={activity}
        />
      </div>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
