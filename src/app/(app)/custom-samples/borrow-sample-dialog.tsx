"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { addDays, formatDate, todayMyt } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { borrowCustomSample } from "./custom-sample-actions";
import type { CustomSample } from "./custom-sample-types";

type BorrowSampleDialogProps = {
  sample: Pick<CustomSample, "id" | "code" | "designName">;
  loanDays: number;
  /** Company names offered while typing the customer. */
  customers: readonly string[];
  /** The salespeople to choose from, for the MD; null when the borrower is the person signed in. */
  sellers: readonly { id: string; name: string }[] | null;
  meName: string;
};

function textOf(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Lends an available sample (demo sheetTfBorrow): for which customer, from when, and when it is due back. */
export function BorrowSampleDialog({
  sample,
  loanDays,
  customers,
  sellers,
  meName,
}: BorrowSampleDialogProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outOn, setOutOn] = useState(todayMyt());
  const [salespersonId, setSalespersonId] = useState("");

  function openChanged(next: boolean) {
    setOpen(next);
    if (!next) return;
    setError(null);
    setOutOn(todayMyt());
    setSalespersonId("");
  }

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await borrowCustomSample({
        sampleId: sample.id,
        salespersonId: sellers ? salespersonId || null : null,
        customer: textOf(formData, "customer"),
        project: textOf(formData, "project"),
        outOn,
      });
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      const who =
        sellers?.find((seller) => seller.id === salespersonId)?.name ?? meName;
      toast.success(
        `${sample.code} ${t("borrowed by")} ${who} – ${t("return by")} ${formatDate(result.dueOn)}`,
      );
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={openChanged}>
      <DialogTrigger asChild>
        <Button size="sm">{t("Borrow")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{`${t("Borrow")} ${sample.code}`}</DialogTitle>
          <DialogDescription>
            {`${sample.designName} · ${t("loan period")} ${loanDays} ${t("days")}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            {sellers && (
              <Field>
                <FieldLabel htmlFor="borrowSalesperson">
                  {t("Salesperson")} *
                </FieldLabel>
                <Select value={salespersonId} onValueChange={setSalespersonId}>
                  <SelectTrigger id="borrowSalesperson">
                    <SelectValue placeholder={t("Choose the salesperson")} />
                  </SelectTrigger>
                  <SelectContent>
                    {sellers.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="borrowCustomer">
                {t("For which customer")} *
              </FieldLabel>
              <Input
                id="borrowCustomer"
                name="customer"
                list="borrowCustomers"
                maxLength={200}
                placeholder={t("Company name")}
                required
              />
              <datalist id="borrowCustomers">
                {customers.map((customer) => (
                  <option key={customer} value={customer} />
                ))}
              </datalist>
            </Field>
            <Field>
              <FieldLabel htmlFor="borrowProject">{t("Project")}</FieldLabel>
              <Input
                id="borrowProject"
                name="project"
                maxLength={200}
                placeholder={t("e.g. Hotel lobby, Level 3")}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="borrowDate">{t("Borrow date")}</FieldLabel>
                <Input
                  id="borrowDate"
                  type="date"
                  value={outOn}
                  onChange={(event) => setOutOn(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="borrowDue">{t("Return by")}</FieldLabel>
                <Input
                  id="borrowDue"
                  type="date"
                  value={outOn ? addDays(outOn, loanDays) : ""}
                  readOnly
                />
              </Field>
            </div>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending} className="self-start">
              {pending ? t("Saving...") : t("Borrow")}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
