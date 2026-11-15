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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEFTOVER_RETURN_METHOD_LABEL,
  LEFTOVER_RETURN_METHODS,
  type LeftoverReturnMethod,
} from "@/lib/domain/leftover";
import { isOneOf } from "@/lib/form/one-of";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { collectLeftover } from "./collect-actions";

/**
 * A site supervisor marks an item collected, says how it goes back, and ticks that the office
 * has the WhatsApp with the photo.
 */
export function CollectLeftoverDialog({
  leftoverId,
  item,
  returnMethod,
  whatsappSent,
  collected,
}: {
  leftoverId: string;
  item: string;
  returnMethod: LeftoverReturnMethod | null;
  whatsappSent: boolean;
  collected: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<LeftoverReturnMethod | "">(
    returnMethod ?? "",
  );
  const [sent, setSent] = useState(whatsappSent);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await collectLeftover(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(
          collected ? "Leftover stock updated." : "Marked as collected.",
        );
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="xs" variant="outline">
          {collected ? "Update" : "Mark collected"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item}</DialogTitle>
          <DialogDescription>
            Say how it goes back and WhatsApp the office a photo of the stock.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="leftoverId" value={leftoverId} />
          <input type="hidden" name="returnMethod" value={method} />
          <input type="hidden" name="whatsappSent" value={sent ? "on" : ""} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`collect-method-${leftoverId}`}>
                How is it going back?
              </FieldLabel>
              <Select
                value={method}
                onValueChange={(value) => {
                  if (isOneOf(LEFTOVER_RETURN_METHODS, value)) setMethod(value);
                }}
              >
                <SelectTrigger id={`collect-method-${leftoverId}`}>
                  <SelectValue placeholder="Choose how" />
                </SelectTrigger>
                <SelectContent>
                  {LEFTOVER_RETURN_METHODS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LEFTOVER_RETURN_METHOD_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Purchasing arranges Lalamove or the lorry when you choose
                transport.
              </FieldDescription>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id={`collect-wa-${leftoverId}`}
                checked={sent}
                disabled={whatsappSent}
                onCheckedChange={(checked) => setSent(checked === true)}
              />
              <FieldLabel htmlFor={`collect-wa-${leftoverId}`}>
                I sent the office the WhatsApp with a photo
              </FieldLabel>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
