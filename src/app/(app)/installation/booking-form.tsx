"use client";

import { Plus } from "lucide-react";
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
  FieldDescription,
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
import {
  BOOKING_PURPOSE_LABEL,
  BOOKING_PURPOSES,
  type BookingPurpose,
  DEFAULT_BOOKING_TIME,
} from "@/lib/domain/site-booking";
import { requestBooking } from "./booking-actions";
import type { BookableProject } from "./booking-data";

type BookingDialogProps = {
  supervisors: { id: string; name: string }[];
  projects: BookableProject[];
  /** The day to book for until the person picks another. */
  defaultDate: string;
};

const NO_PROJECT = "none";

/** Asks a site supervisor to come to a site. They confirm or decline from the calendar. */
export function BookingDialog(props: BookingDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus data-icon="inline-start" />
          Book a site supervisor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book a site supervisor</DialogTitle>
          <DialogDescription>
            The supervisor confirms or declines. Check the calendar first to see
            when they are free.
          </DialogDescription>
        </DialogHeader>
        <BookingForm {...props} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BookingForm({
  supervisors,
  projects,
  defaultDate,
  onSaved,
}: BookingDialogProps & { onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [supervisor, setSupervisor] = useState(supervisors[0]?.id ?? "");
  const [purpose, setPurpose] = useState<BookingPurpose>("site_measurement");
  const [project, setProject] = useState(NO_PROJECT);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await requestBooking(formData);
      setError(result.error);
      if (!result.error) {
        toast.success("Booking request sent.");
        onSaved();
      }
    });
  }

  return (
    <form action={save}>
      <input type="hidden" name="supervisorId" value={supervisor} />
      <input type="hidden" name="purpose" value={purpose} />
      <input
        type="hidden"
        name="projectId"
        value={project === NO_PROJECT ? "" : project}
      />
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bookingSupervisor">Site supervisor</FieldLabel>
            <Select value={supervisor} onValueChange={setSupervisor}>
              <SelectTrigger id="bookingSupervisor">
                <SelectValue placeholder="Choose the supervisor" />
              </SelectTrigger>
              <SelectContent>
                {supervisors.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="bookingPurpose">Purpose</FieldLabel>
            <Select
              value={purpose}
              onValueChange={(value) => setPurpose(value as BookingPurpose)}
            >
              <SelectTrigger id="bookingPurpose">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_PURPOSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {BOOKING_PURPOSE_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="visitOn">Date</FieldLabel>
            <Input
              id="visitOn"
              name="visitOn"
              type="date"
              defaultValue={defaultDate}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bookingTime">Time</FieldLabel>
            <Input
              id="bookingTime"
              name="startTime"
              type="time"
              className="font-mono"
              defaultValue={DEFAULT_BOOKING_TIME}
              required
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="bookingProject">Project</FieldLabel>
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger id="bookingProject">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PROJECT}>
                Other site (type below)
              </SelectItem>
              {projects.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {project === NO_PROJECT && (
          <Field>
            <FieldLabel htmlFor="bookingSite">Site / location</FieldLabel>
            <Input id="bookingSite" name="site" maxLength={200} />
            <FieldDescription>
              For a site that is not one of your projects.
            </FieldDescription>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="bookingNotes">
            Note for the supervisor
          </FieldLabel>
          <Input
            id="bookingNotes"
            name="notes"
            placeholder="e.g. Client wants to see the sample laid out"
            maxLength={300}
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending || supervisor === ""}>
          {pending ? "Sending..." : "Send booking request"}
        </Button>
      </FieldGroup>
    </form>
  );
}
