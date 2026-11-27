"use client";

import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { summariseInstallerPo } from "@/lib/domain/installer-claim";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { formatRm } from "@/lib/format/money";
import { recordInstallerPayment } from "../installer-actions";
import { FormDialog, useSubmit } from "./form-dialog";
import type { InstallerClaimRow, InstallerPoRow } from "./installer-claims";

export function InstallerPaymentDialog({
  mofId,
  po,
  claim,
  today,
}: {
  mofId: string;
  po: InstallerPoRow;
  claim: InstallerClaimRow;
  today: string;
}) {
  // What this claim pays after its share of retention, as a starting figure.
  const suggested = summariseInstallerPo(po, [{ ...claim, paidAmount: 0 }]).due;
  return (
    <FormDialog
      trigger={
        <Button size="sm" variant={claim.paidOn ? "outline" : "default"}>
          <Wallet data-icon="inline-start" />
          {claim.paidOn ? "Edit payment" : "Record payment"}
        </Button>
      }
      title={`Payment for ${po.installer}`}
      description={`Claim of ${formatRm(claim.amount)}, verified by ${claim.verifiedBy}. After ${po.retentionPct}% retention it pays ${formatRm(suggested)}.`}
    >
      {(done) => (
        <InstallerPaymentForm
          mofId={mofId}
          claim={claim}
          suggested={suggested}
          today={today}
          onSaved={done}
        />
      )}
    </FormDialog>
  );
}

function InstallerPaymentForm({
  mofId,
  claim,
  suggested,
  today,
  onSaved,
}: {
  mofId: string;
  claim: InstallerClaimRow;
  suggested: number;
  today: string;
  onSaved: () => void;
}) {
  const { pending, error, submit } = useSubmit(
    recordInstallerPayment,
    "Payment recorded.",
    onSaved,
  );
  return (
    <form onSubmit={submitKeepingValues(submit)}>
      <input type="hidden" name="mofId" value={mofId} />
      <input type="hidden" name="claimId" value={claim.id} />
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="paidAmount">Amount paid (RM)</FieldLabel>
            <Input
              id="paidAmount"
              name="paidAmount"
              inputMode="decimal"
              className="font-mono"
              defaultValue={claim.paidOn ? claim.paidAmount : suggested}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="paidOn">Date paid</FieldLabel>
            <Input
              id="paidOn"
              name="paidOn"
              type="date"
              defaultValue={claim.paidOn ?? today}
              required
            />
          </Field>
        </div>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save payment"}
        </Button>
      </FieldGroup>
    </form>
  );
}
