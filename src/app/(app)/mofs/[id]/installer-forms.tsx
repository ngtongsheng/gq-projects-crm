"use client";

import { Pencil, Plus, Wallet } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
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
  INSTALLER_CLAIM_TYPE_LABEL,
  INSTALLER_CLAIM_TYPES,
  summariseInstallerPo,
} from "@/lib/domain/installer-claim";
import { formatRm } from "@/lib/format/money";
import {
  type InstallerResult,
  recordInstallerPayment,
  saveInstallerClaim,
  saveInstallerPo,
} from "../installer-actions";
import type { InstallerClaimRow, InstallerPoRow } from "./installer-claims";

type FormShellProps = {
  trigger: ReactNode;
  title: string;
  description: string;
  children: (done: () => void) => ReactNode;
};

/** Radix unmounts the content on close, so each opening starts from the saved values. */
function FormDialog({ trigger, title, description, children }: FormShellProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

/** Runs a server action from a form, toasting the outcome and closing on success. */
function useSubmit(
  action: (formData: FormData) => Promise<InstallerResult>,
  savedMessage: string,
  onSaved: () => void,
) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await action(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(savedMessage);
        onSaved();
      }
    });
  };
  return { pending, error, submit };
}

export function InstallerPoDialog({
  mofId,
  po,
  defaultInstaller,
}: {
  mofId: string;
  po?: InstallerPoRow;
  defaultInstaller: string;
}) {
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
      {(done) => (
        <InstallerPoForm
          mofId={mofId}
          po={po}
          defaultInstaller={defaultInstaller}
          onSaved={done}
        />
      )}
    </FormDialog>
  );
}

function InstallerPoForm({
  mofId,
  po,
  defaultInstaller,
  onSaved,
}: {
  mofId: string;
  po?: InstallerPoRow;
  defaultInstaller: string;
  onSaved: () => void;
}) {
  const { pending, error, submit } = useSubmit(
    saveInstallerPo,
    po ? "Installer PO saved." : "Installer PO added.",
    onSaved,
  );
  return (
    <form action={submit}>
      <input type="hidden" name="mofId" value={mofId} />
      {po && <input type="hidden" name="poId" value={po.id} />}
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="installer">Installer</FieldLabel>
            <Input
              id="installer"
              name="installer"
              defaultValue={po?.installer ?? defaultInstaller}
              maxLength={100}
              required
            />
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
    <form action={submit}>
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
    <form action={submit}>
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
