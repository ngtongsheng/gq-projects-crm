"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  SITE_ACTIVITIES,
  SITE_ACTIVITY_LABEL,
  type SiteActivity,
} from "@/lib/domain/site-log";
import { addSiteLog } from "./actions";

type SiteLogDialogProps = {
  mofId: string;
  /** Malaysia date, so the default matches the server. */
  today: string;
};

/** Logs a site visit: what was done, notes, whether the measurement and handover came through. */
export function SiteLogDialog({ mofId, today }: SiteLogDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<SiteActivity>("inspection");

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await addSiteLog(formData);
      setError(result.error);
      if (!result.error) {
        toast.success("Site visit logged.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus data-icon="inline-start" />
          Log a visit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log a site visit</DialogTitle>
          <DialogDescription>
            Add follow-up actions to the visit once it is saved.
          </DialogDescription>
        </DialogHeader>
        <form action={save}>
          <input type="hidden" name="mofId" value={mofId} />
          <input type="hidden" name="activity" value={activity} />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="logActivity">Activity</FieldLabel>
                <Select
                  value={activity}
                  onValueChange={(value) => setActivity(value as SiteActivity)}
                >
                  <SelectTrigger id="logActivity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITE_ACTIVITIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SITE_ACTIVITY_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="logDate">Date of visit</FieldLabel>
                <Input
                  id="logDate"
                  name="visitedOn"
                  type="date"
                  defaultValue={today}
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="logNotes">Notes</FieldLabel>
              <Textarea
                id="logNotes"
                name="notes"
                maxLength={1000}
                placeholder="What you found and what was done"
              />
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="logMeasurement" name="measurementReceived" />
              <FieldLabel htmlFor="logMeasurement" className="font-normal">
                Measurement received
              </FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="logHandover" name="handoverSigned" />
              <FieldLabel htmlFor="logHandover" className="font-normal">
                Handover signed
              </FieldLabel>
            </Field>
            <Field>
              <FieldLabel htmlFor="logDrive">Drive link</FieldLabel>
              <Input
                id="logDrive"
                name="driveLink"
                type="url"
                inputMode="url"
                placeholder="https://drive.google.com/..."
                maxLength={2000}
              />
              <FieldDescription>
                Photos, videos and signed forms stay in Drive; paste the link
                here.
              </FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save visit"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
