"use client";

import { type ReactNode, useState, useTransition } from "react";
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INSTALLER_SKILLS } from "@/lib/domain/installer";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { saveInstaller } from "./installer-actions";
import type { InstallerRow } from "./installer-data";

type InstallerDialogProps = {
  /** The installer to edit; without one the dialog adds a new installer. */
  installer?: InstallerRow;
  /** What opens the dialog: the Add button, or an installer's name. */
  children: ReactNode;
};

/** Adds an installer to the directory, or edits one (demo: sheetInstaller). */
export function InstallerDialog({ installer, children }: InstallerDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveInstaller(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(installer ? "Installer saved." : "Installer added.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {installer ? "Edit installer" : "Add installer"}
          </DialogTitle>
          <DialogDescription>
            Name and phone are needed. The rest helps others pick the right
            installer for a job.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="installerId" value={installer?.id ?? ""} />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="installerName">Name *</FieldLabel>
                <Input
                  id="installerName"
                  name="name"
                  defaultValue={installer?.name}
                  placeholder="e.g. Ahmad"
                  maxLength={100}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="installerCompany">Company</FieldLabel>
                <Input
                  id="installerCompany"
                  name="company"
                  defaultValue={installer?.company}
                  maxLength={100}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="installerPhone">Phone *</FieldLabel>
                <Input
                  id="installerPhone"
                  name="phone"
                  type="tel"
                  className="font-mono"
                  defaultValue={installer?.phone}
                  placeholder="012-345 6789"
                  maxLength={30}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="installerPhone2">Phone 2</FieldLabel>
                <Input
                  id="installerPhone2"
                  name="phone2"
                  type="tel"
                  className="font-mono"
                  defaultValue={installer?.phone2}
                  maxLength={30}
                />
              </Field>
            </div>
            <FieldSet>
              <FieldLegend variant="label">Skills</FieldLegend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {INSTALLER_SKILLS.map((skill) => (
                  <Field
                    key={skill}
                    orientation="horizontal"
                    className="w-auto"
                  >
                    <Checkbox
                      id={`skill-${skill}`}
                      name="skills"
                      value={skill}
                      defaultChecked={installer?.skills.includes(skill)}
                    />
                    <FieldLabel
                      htmlFor={`skill-${skill}`}
                      className="font-normal"
                    >
                      {skill}
                    </FieldLabel>
                  </Field>
                ))}
              </div>
            </FieldSet>
            <Field>
              <FieldLabel htmlFor="installerDescription">
                What they can do
              </FieldLabel>
              <Textarea
                id="installerDescription"
                name="description"
                rows={3}
                defaultValue={installer?.description}
                placeholder="e.g. Carpet tile and vinyl for offices, can do night shift, own team of 6, good with stair nosing. Not for timber."
                maxLength={500}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="installerArea">Area covered</FieldLabel>
              <Input
                id="installerArea"
                name="area"
                defaultValue={installer?.area}
                placeholder="e.g. Klang Valley, Penang"
                maxLength={100}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="installerNotes">Notes</FieldLabel>
              <Textarea
                id="installerNotes"
                name="notes"
                rows={3}
                defaultValue={installer?.notes}
                placeholder="Rate, availability, anything else"
                maxLength={500}
              />
            </Field>
            {installer && (
              <Field orientation="horizontal">
                <Checkbox
                  id="installerActive"
                  name="active"
                  defaultChecked={installer.active}
                />
                <FieldLabel htmlFor="installerActive" className="font-normal">
                  Active (shows in installer lists)
                </FieldLabel>
              </Field>
            )}
            {!installer && (
              <FieldDescription>
                An installer is never deleted. One who stops working with GQ is
                made inactive instead.
              </FieldDescription>
            )}
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : installer ? "Save" : "Add installer"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
