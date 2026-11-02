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
import { recordPayment, removePayment } from "./actions";
import type { Payment } from "./collection-data";

type PaymentsDialogProps = {
  mofId: string;
  title: string;
  outstanding: number;
  payments: Payment[];
  /** Only the MD and HR & Accounts record or remove payments. */
  canEnter: boolean;
  /** Malaysia date, so the default matches the server. */
  today: string;
};

/** The payments on one order, and for the MD and HR & Accounts a form to add one. */
export function PaymentsDialog({
  mofId,
  title,
  outstanding,
  payments,
  canEnter,
  today,
}: PaymentsDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await recordPayment(formData);
      setError(result.error);
      if (!result.error) toast.success("Payment recorded.");
    });
  }

  function remove(paymentId: string) {
    startTransition(async () => {
      const result = await removePayment(paymentId);
      if (result.error) toast.error(result.error);
      else toast.success("Payment removed.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {canEnter ? "Payments" : "View payments"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {outstanding > 0
              ? `${formatRm(outstanding)} still to collect.`
              : "Nothing left to collect."}
          </DialogDescription>
        </DialogHeader>

        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payments received yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="font-mono tabular-nums">
                  {formatDate(payment.receivedOn)}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {payment.note}
                </span>
                <span className="font-mono font-medium tabular-nums">
                  {formatRm(payment.amount)}
                </span>
                {canEnter && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove the ${formatRm(payment.amount)} payment`}
                    disabled={pending}
                    onClick={() => remove(payment.id)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEnter && (
          <form action={save}>
            <input type="hidden" name="mofId" value={mofId} />
            <FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor={`amount-${mofId}`}>
                    Amount (RM)
                  </FieldLabel>
                  <Input
                    id={`amount-${mofId}`}
                    name="amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`received-${mofId}`}>
                    Date received
                  </FieldLabel>
                  <Input
                    id={`received-${mofId}`}
                    name="receivedOn"
                    type="date"
                    defaultValue={today}
                    max={today}
                    required
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor={`note-${mofId}`}>Note</FieldLabel>
                <Input
                  id={`note-${mofId}`}
                  name="note"
                  maxLength={300}
                  placeholder="e.g. Cheque 123456, progress claim 2"
                />
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Record payment"}
              </Button>
            </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
