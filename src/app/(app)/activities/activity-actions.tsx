"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setActivityStatus } from "./actions";
import { ActivityDialog, type EditableActivity } from "./activity-form";

type ActivityActionsProps = {
  contactId: string;
  customerName: string;
  activity: EditableActivity;
};

/** Edit for the owner; complete and cancel while the activity is still planned. */
export function ActivityActions({
  contactId,
  customerName,
  activity,
}: ActivityActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(status: "completed" | "cancelled") {
    startTransition(async () => {
      const result = await setActivityStatus(activity.id, status);
      setError(result.error);
      if (!result.error) {
        toast.success(
          status === "completed" ? "Marked completed." : "Activity cancelled.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {activity.status === "planned" && (
          <>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => move("completed")}
            >
              Complete
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => move("cancelled")}
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
