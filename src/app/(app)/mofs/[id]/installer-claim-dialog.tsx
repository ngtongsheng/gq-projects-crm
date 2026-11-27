"use client";

import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  INSTALLER_CLAIM_TYPE_LABEL,
  INSTALLER_CLAIM_TYPES,
} from "@/lib/domain/installer-claim";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { saveInstallerClaim } from "../installer-actions";
import { FormDialog, useSubmit } from "./form-dialog";
import type { InstallerClaimRow, InstallerPoRow } from "./installer-claims";

export function InstallerClaimDialog({
  mofId,
  pos,
  po,
  claim,
  today,
}: {
  mofId: string;
  pos: InstallerPoRow[];
  /** The PO the claim belongs to, when editing. */
  po?: InstallerPoRow;
  claim?: InstallerClaimRow;
  today: string;
}) {
  return (
    <FormDialog
      trigger={
        claim ? (
          <Button size="sm" variant="outline">
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus data-icon="inline-start" />
            Installer claim
          </Button>
        )
      }
      title={claim ? "Update installer claim" : "Add installer claim"}
      description={
        claim?.verified
          ? "Changing the type, amount or date clears the site supervisor's verification."
          : "Progress and final claims cannot pass the installer PO amount. A deduction is taken off what is owed."
      }
    >
      {(done) => (
        <InstallerClaimForm
          mofId={mofId}
          pos={pos}
          po={po}
          claim={claim}
          today={today}
          onSaved={done}
        />
      )}
    </FormDialog>
  );
}

function InstallerClaimForm({
  mofId,
  pos,
  po,
  claim,
  today,
  onSaved,
}: {
  mofId: string;
  pos: InstallerPoRow[];
  po?: InstallerPoRow;
  claim?: InstallerClaimRow;
  today: string;
  onSaved: () => void;
}) {
  const { pending, error, submit } = useSubmit(
    saveInstallerClaim,
    claim ? "Claim saved." : "Claim added.",
    onSaved,
  );
  return (
    <form onSubmit={submitKeepingValues(submit)}>
      <input type="hidden" name="mofId" value={mofId} />
      {claim && <input type="hidden" name="claimId" value={claim.id} />}
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="installerPoId">Installer</FieldLabel>
            <Select
              name="installerPoId"
              defaultValue={po?.id ?? pos[0]?.id}
              disabled={claim !== undefined}
            >
              <SelectTrigger id="installerPoId">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pos.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.installer} · {option.poNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {claim && (
              <input type="hidden" name="installerPoId" value={po?.id} />
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="type">Type</FieldLabel>
            <Select name="type" defaultValue={claim?.type ?? "progress"}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTALLER_CLAIM_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {INSTALLER_CLAIM_TYPE_LABEL[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="claimedOn">Claim date</FieldLabel>
            <Input
              id="claimedOn"
              name="claimedOn"
              type="date"
              defaultValue={claim?.claimedOn ?? today}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="claimNo">Claim / invoice no.</FieldLabel>
            <Input
              id="claimNo"
              name="claimNo"
              className="font-mono"
              defaultValue={claim?.claimNo}
              maxLength={50}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="amount">Amount (RM)</FieldLabel>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            className="font-mono"
            defaultValue={claim?.amount}
            required
          />
          <FieldDescription>
            For a deduction, the amount to deduct.
          </FieldDescription>
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save claim"}
        </Button>
      </FieldGroup>
    </form>
  );
}
