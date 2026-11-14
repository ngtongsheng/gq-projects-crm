"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type CalendarEvent,
  CalendarEventLink,
} from "@/components/app/calendar-event";
import { Button } from "@/components/ui/button";
import { answerInvitation, type InvitationAnswer } from "./invitation-actions";

/** A pending invitation in the week view, with the two answers. */
export function InvitationCard({ event }: { event: CalendarEvent }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function answer(answerValue: InvitationAnswer) {
    startTransition(async () => {
      const result = await answerInvitation(event.id, answerValue);
      setError(result.error);
      if (!result.error) {
        toast.success(
          answerValue === "accepted"
            ? "Accepted. It is in your calendar."
            : "Declined.",
        );
      }
    });
  }

  return (
    <div className="grid gap-1">
      <CalendarEventLink event={event} />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => answer("accepted")}>
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => answer("declined")}
        >
          Can't go
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
