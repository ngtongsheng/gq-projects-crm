"use client";

import { Pencil, Plus } from "lucide-react";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
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
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { deleteEnquiry, saveEnquiry } from "./enquiry-actions";
import {
  DEFAULT_FX,
  EnquiryCurrency,
  EnquiryUnit,
  EnquiryUnitLabel,
  type EnquiryView,
} from "./enquiry-view";

export type SalespersonChoice = { id: string; name: string };

type DialogProps = {
  enquiry?: EnquiryView;
  /** Today in Malaysia, the date of a new enquiry. */
  today: string;
  /** Purchasing and the managers give the reply and may pick the salesperson. */
  canReply: boolean;
  salespeople: SalespersonChoice[];
  /** Fixed when the enquiry is raised from a costing. */
  quoteNo?: string;
  salespersonId?: string;
};

/** Value of the "no salesperson" item; Radix Select cannot hold an empty string. */
const NONE = "none";

const numberText = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/** Radix unmounts the content on close, so each opening starts from the saved values. */
export function EnquiryDialog(props: DialogProps) {
  const [open, setOpen] = useState(false);
  const { enquiry } = props;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {enquiry ? (
          <Button size="sm" variant="outline">
            <Pencil data-icon="inline-start" />
            {props.canReply && enquiry.status === "pending" ? "Reply" : "Edit"}
          </Button>
        ) : (
          <Button size="sm">
            <Plus data-icon="inline-start" />
            New enquiry
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {enquiry ? "FOB enquiry" : "New FOB enquiry"}
          </DialogTitle>
          <DialogDescription>
            {props.canReply
              ? "Note what sales asked for, then fill in the supplier's reply."
              : "Purchasing replies here with the FOB price, rate and shipping."}
          </DialogDescription>
        </DialogHeader>
        <EnquiryForm {...props} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EnquiryForm({
  enquiry,
  today,
  canReply,
  salespeople,
  quoteNo,
  salespersonId,
  onDone,
}: DialogProps & { onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<EnquiryCurrency>(
    enquiry?.currency ?? "USD",
  );
  const [confirmRemove, setConfirmRemove] = useState(false);
  const pickSalesperson = canReply && salespersonId === undefined;

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveEnquiry(formData);
      setError(result.error);
      if (result.error) return;
      toast.success(enquiry ? "Enquiry saved." : "Enquiry added.");
      onDone();
    });
  }

  function remove() {
    if (!enquiry) return;
    startTransition(async () => {
      const result = await deleteEnquiry(enquiry.id);
      setError(result.error);
      setConfirmRemove(false);
      if (result.error) return;
      toast.success("Enquiry removed.");
      onDone();
    });
  }

  return (
    <form onSubmit={submitKeepingValues(save)}>
      {enquiry && <input type="hidden" name="enquiryId" value={enquiry.id} />}
      {salespersonId !== undefined && (
        <input type="hidden" name="salespersonId" value={salespersonId} />
      )}
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">What sales asked for</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="enquiryDate">Date</FieldLabel>
              <Input
                id="enquiryDate"
                name="enquiryDate"
                type="date"
                defaultValue={enquiry?.date ?? today}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="quoteNo">Quotation No.</FieldLabel>
              <Input
                id="quoteNo"
                name="quoteNo"
                className="font-mono"
                defaultValue={enquiry?.quoteNo ?? quoteNo ?? ""}
                readOnly={quoteNo !== undefined}
                maxLength={40}
                placeholder="GQ5127"
              />
              <FieldDescription>
                Leave blank if the costing is not started yet.
              </FieldDescription>
            </Field>
          </div>
          {pickSalesperson && (
            <Field>
              <FieldLabel htmlFor="salespersonId">Salesperson</FieldLabel>
              <Select
                name="salespersonId"
                defaultValue={enquiry?.salespersonId ?? NONE}
              >
                <SelectTrigger id="salespersonId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Same as the costing</SelectItem>
                  {salespeople.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="product">Product / spec</FieldLabel>
            <Input
              id="product"
              name="product"
              defaultValue={enquiry?.product}
              maxLength={300}
              placeholder="Axminster 42oz"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sizes">Sizes (optional)</FieldLabel>
            <Textarea
              id="sizes"
              name="sizes"
              defaultValue={enquiry?.sizes}
              rows={3}
              maxLength={4000}
              className="font-mono"
              placeholder={"1.83x1.5 x 799\n2.2x1.35 x 799"}
            />
            <FieldDescription>
              One line each: length x width in metres x pieces. The quantity
              below is then worked out in m².
            </FieldDescription>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="qty">Quantity</FieldLabel>
              <Input
                id="qty"
                name="qty"
                inputMode="decimal"
                className="font-mono"
                defaultValue={numberText(enquiry?.qty)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="unit">Unit</FieldLabel>
              <Select name="unit" defaultValue={enquiry?.unit ?? "m2"}>
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EnquiryUnit.options.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {EnquiryUnitLabel[unit]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="supplier">Supplier</FieldLabel>
              <Input
                id="supplier"
                name="supplier"
                defaultValue={enquiry?.supplier}
                maxLength={200}
              />
            </Field>
          </div>
        </FieldSet>
        {canReply && (
          <FieldSet>
            <FieldLegend variant="label">The supplier's reply</FieldLegend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="currency">Currency</FieldLabel>
                <Select
                  name="currency"
                  value={currency}
                  onValueChange={(value) =>
                    setCurrency(EnquiryCurrency.parse(value))
                  }
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EnquiryCurrency.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="fob">FOB per unit</FieldLabel>
                <Input
                  id="fob"
                  name="fob"
                  inputMode="decimal"
                  className="font-mono"
                  defaultValue={numberText(enquiry?.fob)}
                />
                <FieldDescription>
                  Leave blank while the supplier has not replied.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="fx">1 {currency} = RM</FieldLabel>
                <Input
                  id="fx"
                  name="fx"
                  inputMode="decimal"
                  className="font-mono"
                  defaultValue={numberText(enquiry?.fx)}
                  placeholder={String(DEFAULT_FX[currency])}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="shipping">Shipping RM per unit</FieldLabel>
                <Input
                  id="shipping"
                  name="shipping"
                  inputMode="decimal"
                  className="font-mono"
                  defaultValue={numberText(enquiry?.shipping)}
                  placeholder="0"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Input
                id="notes"
                name="notes"
                defaultValue={enquiry?.notes}
                maxLength={500}
                placeholder="Lead time, MOQ"
              />
            </Field>
          </FieldSet>
        )}
        {error && <FieldError>{error}</FieldError>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save enquiry"}
          </Button>
          {enquiry &&
            (confirmRemove ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={remove}
                >
                  Yes, remove it
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmRemove(false)}
                >
                  Keep it
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmRemove(true)}
              >
                Remove
              </Button>
            ))}
        </div>
      </FieldGroup>
    </form>
  );
}
