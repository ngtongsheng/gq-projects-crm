"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { type Option, OptionalSelect } from "@/app/(app)/mofs/mof-form-fields";
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
import { Textarea } from "@/components/ui/textarea";
import {
  CommissionMode,
  CommissionModeLabel,
  JobRole,
  JobRoleLabel,
} from "@/lib/auth/job-role";
import { formatMobile } from "@/lib/domain/mobile";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { updatePersonSettings } from "./actions";
import { Language, LanguageLabel } from "./schemas";

export type PersonSettings = {
  userId: string;
  name: string | null;
  jobRole: JobRole;
  arrangesStock: boolean;
  sells: boolean;
  seesMargin: boolean;
  commissionMode: CommissionMode;
  yearlyTarget: number | null;
  whatsapp: string | null;
  title: string | null;
  joinedOn: string | null;
  reportsTo: string | null;
  language: Language;
  active: boolean;
  leftOn: string | null;
  leftReason: string | null;
};

/** Radix unmounts the content on close, so each opening starts from the saved values. */
export function PersonSettingsDialog({
  person,
  leads,
}: {
  person: PersonSettings;
  /** Active Sales Directors and Marketing Directors. */
  leads: Option[];
}) {
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{person.name ?? "Person"}</DialogTitle>
          <DialogDescription>
            Their job role decides what they can see and change.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="userId" value={person.userId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input
                id="title"
                name="title"
                maxLength={120}
                placeholder="Purchasing · MOF, installation, delivery, PO"
                defaultValue={person.title ?? ""}
              />
            </Field>
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
            <Field orientation="horizontal">
              <Checkbox id="sells" name="sells" defaultChecked={person.sells} />
              <FieldLabel htmlFor="sells">
                Also sells (Site Supervisor)
              </FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="seesMargin"
                name="seesMargin"
                defaultChecked={person.seesMargin}
              />
              <FieldLabel htmlFor="seesMargin">Sees margin and cost</FieldLabel>
            </Field>
            <Field>
              <FieldLabel htmlFor="reportsTo">Reports to</FieldLabel>
              <OptionalSelect
                id="reportsTo"
                name="reportsTo"
                defaultValue={person.reportsTo ?? ""}
                options={leads.filter((lead) => lead.id !== person.userId)}
                noneLabel="No one"
              />
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="whatsapp">WhatsApp number</FieldLabel>
                <Input
                  id="whatsapp"
                  name="whatsapp"
                  type="tel"
                  inputMode="tel"
                  placeholder="012-345 6789"
                  defaultValue={
                    person.whatsapp ? formatMobile(person.whatsapp) : ""
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="language">Language</FieldLabel>
                <Select name="language" defaultValue={person.language}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Language.options.map((language) => (
                      <SelectItem key={language} value={language}>
                        {LanguageLabel[language]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="joinedOn">Joined on</FieldLabel>
              <Input
                id="joinedOn"
                name="joinedOn"
                type="date"
                defaultValue={person.joinedOn ?? ""}
              />
            </Field>
            <LeftFields person={person} />
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Leaving date and reason appear once "Has left" is ticked; someone who has left cannot sign in. */
function LeftFields({ person }: { person: PersonSettings }) {
  const [hasLeft, setHasLeft] = useState(!person.active);
  return (
    <>
      <Field orientation="horizontal">
        <Checkbox
          id="hasLeft"
          name="hasLeft"
          checked={hasLeft}
          onCheckedChange={(checked) => setHasLeft(checked === true)}
        />
        <FieldLabel htmlFor="hasLeft">
          Has left (can no longer sign in)
        </FieldLabel>
      </Field>
      {hasLeft && (
        <>
          <Field>
            <FieldLabel htmlFor="leftOn">Left on</FieldLabel>
            <Input
              id="leftOn"
              name="leftOn"
              type="date"
              required
              defaultValue={person.leftOn ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="leftReason">Reason (optional)</FieldLabel>
            <Textarea
              id="leftReason"
              name="leftReason"
              maxLength={500}
              defaultValue={person.leftReason ?? ""}
            />
          </Field>
        </>
      )}
    </>
  );
}
