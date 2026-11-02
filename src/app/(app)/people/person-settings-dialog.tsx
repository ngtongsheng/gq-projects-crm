"use client";

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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CommissionMode,
  CommissionModeLabel,
  JobRole,
  JobRoleLabel,
} from "@/lib/auth/job-role";
import { updatePersonSettings } from "./actions";

export type PersonSettings = {
  userId: string;
  name: string | null;
  jobRole: JobRole;
  arrangesStock: boolean;
  commissionMode: CommissionMode;
  yearlyTarget: number | null;
};

/** Radix unmounts the content on close, so each opening starts from the saved values. */
export function PersonSettingsDialog({ person }: { person: PersonSettings }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await updatePersonSettings(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Settings saved.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{person.name ?? "Person"}</DialogTitle>
          <DialogDescription>
            Their job role decides what they can see and change.
          </DialogDescription>
        </DialogHeader>
        <form action={save}>
          <input type="hidden" name="userId" value={person.userId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="jobRole">Job role</FieldLabel>
              <Select name="jobRole" defaultValue={person.jobRole}>
                <SelectTrigger id="jobRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JobRole.options.map((jobRole) => (
                    <SelectItem key={jobRole} value={jobRole}>
                      {JobRoleLabel[jobRole]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="arrangesStock"
                name="arrangesStock"
                defaultChecked={person.arrangesStock}
              />
              <FieldLabel htmlFor="arrangesStock">Arranges stock</FieldLabel>
            </Field>
            <Field>
              <FieldLabel htmlFor="commissionMode">Commission</FieldLabel>
              <Select
                name="commissionMode"
                defaultValue={person.commissionMode}
              >
                <SelectTrigger id="commissionMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CommissionMode.options.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {CommissionModeLabel[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="yearlyTarget">Yearly target (RM)</FieldLabel>
              <Input
                id="yearlyTarget"
                name="yearlyTarget"
                inputMode="decimal"
                placeholder="No target"
                defaultValue={person.yearlyTarget ?? ""}
              />
            </Field>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
