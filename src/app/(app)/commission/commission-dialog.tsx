"use client";

import { Trash2 } from "lucide-react";
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
import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { recordPayout, removePayout } from "./actions";
import type { Payout } from "./commission-data";

type CommissionDialogProps = {
  mofId: string;
  personId: string;
  title: string;
  /** How the amount was worked out, one sentence per line. */
  lines: string[];
  payouts: Payout[];
  remaining: number;
  payableNow: number;
  /** Only the MD and HR & Accounts record or remove payouts. */
  canPay: boolean;
  /** Malaysia date, so the default matches the server. */
  today: string;
};

/** How one commission was worked out and what was paid out; for the MD and HR & Accounts, a form to record a payout. */
export function CommissionDialog({
  mofId,
  personId,
  title,
  lines,
  payouts,
  remaining,
  payableNow,
  canPay,
  today,
}: CommissionDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formKey = `${mofId}-${personId}`;

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await recordPayout(formData);
      setError(result.error);
      if (!result.error) toast.success("Payout recorded.");
    });
  }

  function remove(payoutId: string) {
    startTransition(async () => {
      const result = await removePayout(payoutId);
      if (result.error) toast.error(result.error);
      else toast.success("Payout removed.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {canPay ? "Pay out" : "Details"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {payableNow > 0
              ? `${formatRm(payableNow)} can be paid out now.`
              : remaining > 0
                ? `${formatRm(remaining)} earned, not claimable yet.`
                : "Nothing left to pay out."}
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing paid out yet.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {payouts.map((payout) => (
              <li
                key={payout.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="font-mono tabular-nums">
                  {formatDate(payout.paidOn)}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {payout.note}
                </span>
                <span className="font-mono font-medium tabular-nums">
                  {formatRm(payout.amount)}
                </span>
                {canPay && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove the ${formatRm(payout.amount)} payout`}
                    disabled={pending}
                    onClick={() => remove(payout.id)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canPay && payableNow > 0 && (
          <form action={save}>
            <input type="hidden" name="mofId" value={mofId} />
            <input type="hidden" name="profileId" value={personId} />
            <FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor={`amount-${formKey}`}>
                    Amount (RM)
                  </FieldLabel>
                  <Input
                    id={`amount-${formKey}`}
                    name="amount"
                    inputMode="decimal"
                    defaultValue={payableNow.toFixed(2)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`paid-${formKey}`}>Date paid</FieldLabel>
                  <Input
                    id={`paid-${formKey}`}
                    name="paidOn"
                    type="date"
                    defaultValue={today}
                    max={today}
                    required
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor={`note-${formKey}`}>Note</FieldLabel>
                <Input
                  id={`note-${formKey}`}
                  name="note"
                  maxLength={300}
                  placeholder="e.g. November payroll"
                />
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Record payout"}
              </Button>
            </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
