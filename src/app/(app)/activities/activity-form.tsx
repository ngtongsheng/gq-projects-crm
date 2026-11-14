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
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { type Colleague, InviteePicker } from "../calendar/invitee-picker";
import { saveActivity } from "./actions";
import { parseMytInput, toMytInput } from "./activity-time";
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

export type CustomerOption = { id: string; label: string };

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
        <ActivityForm
          contactId={props.contactId}
          activity={props.activity}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

type ActivityFormProps = {
  /** The customer when it is already known, e.g. on the customer page. */
  contactId?: string;
  /** Customers to choose from when `contactId` is not known, e.g. on the calendar. */
  customers?: CustomerOption[];
  activity?: EditableActivity;
  /** Colleagues who can be invited along, for a new activity. None to hide the choice. */
  colleagues?: Colleague[];
  /** Starting date and time for a new activity, as a datetime-local value. Defaults to now. */
  defaultStartsAt?: string;
  /** The type a new activity starts as. Defaults to a visit. */
  defaultType?: ActivityType;
  /** The status a new activity starts as. Defaults to planned when in the future, else completed. */
  defaultStatus?: ActivityStatus;
  onSaved: () => void;
};

export function ActivityForm({
  contactId,
  customers,
  activity,
  colleagues,
  defaultStartsAt,
  defaultType = "visit",
  defaultStatus,
  onSaved,
}: ActivityFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<ActivityType>(activity?.type ?? defaultType);
  const [startsAt] = useState(() =>
    activity
      ? toMytInput(activity.startsAt)
      : (defaultStartsAt ?? toMytInput(new Date())),
  );
  // A day picked in the future is a plan; today or earlier is something that already happened.
  const [newStatus] = useState<ActivityStatus>(() => {
    if (defaultStatus) return defaultStatus;
    const picked = parseMytInput(startsAt);
    return picked && picked > new Date() ? "planned" : "completed";
  });
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
    <form onSubmit={submitKeepingValues(save)}>
      {activity && (
        <input type="hidden" name="activityId" value={activity.id} />
      )}
      {!customers && <input type="hidden" name="contactId" value={contactId} />}
      <FieldGroup>
        {customers && (
          <Field>
            <FieldLabel htmlFor="contactId">Customer</FieldLabel>
            <Select name="contactId" required>
              <SelectTrigger id="contactId">
                <SelectValue placeholder="Choose a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="type">Type</FieldLabel>
          <Select
            name="type"
            value={type}
            onValueChange={(value) => setType(ActivityType.parse(value))}
          >
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
                defaultValue={activity?.status ?? newStatus}
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
        {colleagues && type !== "call" && (
          <InviteePicker colleagues={colleagues} />
        )}
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
