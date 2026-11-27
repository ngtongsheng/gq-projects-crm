"use client";

import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  installerChoices,
  installerIdByName,
  type Person,
} from "@/lib/domain/job-team";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { saveInstallerPo } from "../installer-actions";
import { FormDialog, useSubmit } from "./form-dialog";
import type { InstallerPoRow } from "./installer-claims";

type InstallerPoFormProps = {
  mofId: string;
  po?: InstallerPoRow;
  /** The active installers in the directory. */
  installers: Person[];
  /** The installer named on the MOF, picked when it matches one in the directory. */
  defaultInstaller: string;
};

export function InstallerPoDialog(props: InstallerPoFormProps) {
  const { po } = props;
  return (
    <FormDialog
      trigger={
        po ? (
          <Button size="sm" variant="outline">
            <Pencil data-icon="inline-start" />
            Edit PO
          </Button>
        ) : (
          <Button size="sm">
            <Plus data-icon="inline-start" />
            Installer PO
          </Button>
        )
      }
      title={po ? `Update PO ${po.poNo}` : "Add installer PO"}
      description="The PO issued to the installer for this MOF. Retention is held back from what the installer claims."
    >
      {(done) => <InstallerPoForm {...props} onSaved={done} />}
    </FormDialog>
  );
}

function InstallerPoForm({
  mofId,
  po,
  installers,
  defaultInstaller,
  onSaved,
}: InstallerPoFormProps & { onSaved: () => void }) {
  const choices = installerChoices(
    installers,
    po ? { id: po.installerId, name: po.installer } : null,
  );
  const { pending, error, submit } = useSubmit(
    saveInstallerPo,
    po ? "Installer PO saved." : "Installer PO added.",
    onSaved,
  );
  return (
    <form onSubmit={submitKeepingValues(submit)}>
      <input type="hidden" name="mofId" value={mofId} />
      {po && <input type="hidden" name="poId" value={po.id} />}
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="installerId">Installer</FieldLabel>
            <Select
              name="installerId"
              defaultValue={
                po?.installerId ??
                installerIdByName(installers, defaultInstaller)
              }
              required
            >
              <SelectTrigger id="installerId">
                <SelectValue placeholder="Choose from the directory" />
              </SelectTrigger>
              <SelectContent>
                {choices.map((installer) => (
                  <SelectItem key={installer.id} value={installer.id}>
                    {installer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="poNo">Installer PO no.</FieldLabel>
            <Input
              id="poNo"
              name="poNo"
              className="font-mono"
              defaultValue={po?.poNo}
              maxLength={50}
              required
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="poDate">PO date</FieldLabel>
            <Input
              id="poDate"
              name="poDate"
              type="date"
              defaultValue={po?.poDate}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="amount">PO amount (RM)</FieldLabel>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              className="font-mono"
              defaultValue={po?.amount}
              required
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="scope">Areas / scope</FieldLabel>
            <Input
              id="scope"
              name="scope"
              placeholder="e.g. Levels 3-5 carpet tile"
              defaultValue={po?.scope}
              maxLength={200}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="retentionPct">Retention %</FieldLabel>
            <Input
              id="retentionPct"
              name="retentionPct"
              inputMode="decimal"
              className="font-mono"
              defaultValue={po?.retentionPct ?? 5}
              required
            />
          </Field>
        </div>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save installer PO"}
        </Button>
      </FieldGroup>
    </form>
  );
}
