"use client";

import { CalendarPlus, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveActivity } from "./actions";
import { toMytInput } from "./activity-time";
import {
  ActivityStatus,
  ActivityStatusLabel,
  ActivityType,
  ActivityTypeLabel,
} from "./schemas";

export type EditableActivity = {
  id: string;
  type: ActivityType;
  purpose: string;
  outcome: string;
  /** ISO timestamp as stored. */
  startsAt: string;
  status: ActivityStatus;
};

type ActivityDialogProps = {
  contactId: string;
  customerName: string;
  /** Present when editing; absent when logging a new one. */
  activity?: EditableActivity;
};

/** Radix unmounts the content on close, so each opening starts from the saved values. */
export function ActivityDialog(props: ActivityDialogProps) {
  const [open, setOpen] = useState(false);
  const editing = props.activity !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button size="sm" variant="outline">
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        ) : (
          <Button size="sm">
            <CalendarPlus data-icon="inline-start" />
            Log activity
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit activity" : "Log activity"}
          </DialogTitle>
          <DialogDescription>
            With {props.customerName}. Times are Malaysia time.
          </DialogDescription>
        </DialogHeader>
        <ActivityForm {...props} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ActivityForm({
  contactId,
  activity,
  onSaved,
}: ActivityDialogProps & { onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [startsAt] = useState(() =>
    toMytInput(activity?.startsAt ?? new Date()),
  );
  // Completed and cancelled are final, so only a planned activity can pick a new status.
  const statusLocked = activity !== undefined && activity.status !== "planned";

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveActivity(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(activity ? "Activity saved." : "Activity logged.");
        onSaved();
      }
    });
  }

  return (
    <form action={save}>
      <input type="hidden" name="contactId" value={contactId} />
      {activity && (
        <input type="hidden" name="activityId" value={activity.id} />
      )}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="type">Type</FieldLabel>
          <Select name="type" defaultValue={activity?.type ?? "visit"}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ActivityType.options.map((type) => (
                <SelectItem key={type} value={type}>
                  {ActivityTypeLabel[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="purpose">Purpose</FieldLabel>
          <Input
            id="purpose"
            name="purpose"
            placeholder="e.g. Follow up quotation"
            defaultValue={activity?.purpose}
            maxLength={200}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="startsAt">Date and time</FieldLabel>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              defaultValue={startsAt}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            {statusLocked ? (
              <>
                <input type="hidden" name="status" value={activity.status} />
                <Input
                  id="status"
                  value={ActivityStatusLabel[activity.status]}
                  disabled
                />
              </>
            ) : (
              <Select
                name="status"
                defaultValue={activity?.status ?? "completed"}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ActivityStatus.options
                    .filter((status) => activity || status !== "cancelled")
                    .map((status) => (
                      <SelectItem key={status} value={status}>
                        {ActivityStatusLabel[status]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="outcome">Outcome</FieldLabel>
          <Textarea
            id="outcome"
            name="outcome"
            placeholder="What came of it?"
            defaultValue={activity?.outcome}
            maxLength={2000}
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save activity"}
        </Button>
      </FieldGroup>
    </form>
  );
}
