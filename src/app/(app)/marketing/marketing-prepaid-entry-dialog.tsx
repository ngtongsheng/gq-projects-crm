"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DeleteConfirm } from "@/components/app/delete-confirm";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { textField } from "@/lib/form/form-fields";
import { isOneOf } from "@/lib/form/one-of";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { todayMyt } from "@/lib/format/date";
import { formatRm, parseRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import {
  PREPAID_CURRENCIES,
  type PrepaidCurrency,
  type PrepaidKind,
} from "./marketing-options";
import { exchangeRateText } from "./marketing-prepaid";
import {
  deletePrepaidEntry,
  savePrepaidEntry,
} from "./marketing-prepaid-actions";
import type { PrepaidAccount, PrepaidEntry } from "./marketing-types";

type MarketingPrepaidEntryDialogProps = {
  /** A top-up or a deducted job. An edited entry keeps its kind. */
  kind: PrepaidKind;
  /** The entry being edited; leave out to add one. */
  entry?: PrepaidEntry;
  accounts: readonly PrepaidAccount[];
  /** Vendor names offered while typing; a new name starts a new account. */
  vendors: readonly string[];
  /** The vendor to start with when adding. */
  startVendor: string;
  onClose: () => void;
};

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** Tops up an account or deducts a job from it (demo sheetMkPre). Mounted while open. */
export function MarketingPrepaidEntryDialog({
  kind,
  entry,
  accounts,
  vendors,
  startVendor,
  onClose,
}: MarketingPrepaidEntryDialogProps) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [vendor, setVendor] = useState(entry?.vendorName ?? startVendor);
  const [currency, setCurrency] = useState<PrepaidCurrency>(
    entry?.foreignCurrency ?? "EUR",
  );
  const [amountRm, setAmountRm] = useState(entry?.amountRm.toString() ?? "");
  const [foreignAmount, setForeignAmount] = useState(
    entry?.foreignAmount?.toString() ?? "",
  );
  const [marketingFoc, setMarketingFoc] = useState(
    entry?.marketingFoc ?? false,
  );

  const isTopUp = kind === "top_up";
  const rate = exchangeRateText(
    parseRm(amountRm) ?? 0,
    parseRm(foreignAmount) ?? 0,
    currency,
  );
  const balanceNow = accounts.find((account) =>
    sameName(account.vendorName, vendor),
  )?.balance;

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await savePrepaidEntry({
        id: entry?.id ?? "",
        kind,
        entryOn: textField(formData, "entryOn"),
        vendor: textField(formData, "vendor"),
        description: textField(formData, "description"),
        foreignCurrency: currency,
        foreignAmount: textField(formData, "foreignAmount"),
        amountRm: textField(formData, "amountRm"),
        mofRef: textField(formData, "mofRef"),
        marketingFoc,
        remarks: textField(formData, "remarks"),
      });
      setError(result.error);
      if (result.error !== null) return;
      if (entry || result.balance === undefined) {
        toast.success(t("Saved"));
      } else {
        const balance = `${isTopUp ? t("Topped up · balance") : t("Deducted · balance")} ${formatRm(result.balance)}`;
        toast.success(
          result.low ? `${balance} ${t("– low, top up soon")}` : balance,
        );
      }
      onClose();
    });
  }

  function remove() {
    if (!entry) return;
    startTransition(async () => {
      const result = await deletePrepaidEntry(entry.id);
      setError(result.error);
      setAsking(false);
      if (result.error !== null) return;
      toast.success(t("Entry deleted."));
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry
              ? t("Edit entry")
              : isTopUp
                ? t("Top up prepaid account")
                : t("Deduct a job from prepaid")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="prepaidDate">{t("Date")} *</FieldLabel>
                <Input
                  id="prepaidDate"
                  name="entryOn"
                  type="date"
                  defaultValue={entry?.entryOn ?? todayMyt()}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="prepaidVendor">{t("Vendor")} *</FieldLabel>
                <Input
                  id="prepaidVendor"
                  name="vendor"
                  list="prepaidVendors"
                  value={vendor}
                  onChange={(event) => setVendor(event.target.value)}
                  maxLength={200}
                  required
                />
                <datalist id="prepaidVendors">
                  {vendors.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="prepaidDescription">
                {isTopUp ? t("Description") : `${t("Client – project")} *`}
              </FieldLabel>
              <Input
                id="prepaidDescription"
                name="description"
                defaultValue={entry?.description ?? ""}
                placeholder={
                  isTopUp
                    ? t("e.g. Top-up / advance payment")
                    : t("e.g. Stuarts Design – Hannan Medicare Office")
                }
                maxLength={300}
                required={!isTopUp}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="prepaidForeign">
                  {t("Foreign amount")}
                </FieldLabel>
                <div className="flex gap-2">
                  <Select
                    value={currency}
                    onValueChange={(value) => {
                      if (isOneOf(PREPAID_CURRENCIES, value))
                        setCurrency(value);
                    }}
                  >
                    <SelectTrigger
                      aria-label={t("Currency")}
                      className="w-24 shrink-0"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PREPAID_CURRENCIES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="prepaidForeign"
                    name="foreignAmount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    className="font-mono"
                    placeholder="60"
                    value={foreignAmount}
                    onChange={(event) => setForeignAmount(event.target.value)}
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="prepaidAmount">
                  {isTopUp ? t("Top-up (RM)") : t("Used (RM)")} *
                </FieldLabel>
                <Input
                  id="prepaidAmount"
                  name="amountRm"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="font-mono"
                  value={amountRm}
                  onChange={(event) => setAmountRm(event.target.value)}
                  required
                />
              </Field>
            </div>
            {rate && (
              <p className="font-mono text-xs text-muted-foreground tabular-nums">
                {t("Rate")}: {rate}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="prepaidRef">{t("MOF / ref")}</FieldLabel>
                <Input
                  id="prepaidRef"
                  name="mofRef"
                  defaultValue={entry?.mofRef ?? ""}
                  placeholder="P1513"
                  maxLength={100}
                />
              </Field>
              {!isTopUp && (
                <Field orientation="horizontal" className="self-end pb-2">
                  <Checkbox
                    id="prepaidFoc"
                    checked={marketingFoc}
                    onCheckedChange={(checked) =>
                      setMarketingFoc(checked === true)
                    }
                  />
                  <FieldLabel htmlFor="prepaidFoc" className="font-normal">
                    {t("Marketing cost (F.O.C, not charged to client)")}
                  </FieldLabel>
                </Field>
              )}
            </div>
            <Field>
              <FieldLabel htmlFor="prepaidRemarks">{t("Remarks")}</FieldLabel>
              <Textarea
                id="prepaidRemarks"
                name="remarks"
                rows={2}
                defaultValue={entry?.remarks ?? ""}
                maxLength={1000}
              />
            </Field>
            {!entry && !isTopUp && balanceNow !== undefined && (
              <FieldDescription>
                {t("Balance now")}:{" "}
                <strong className="font-mono tabular-nums">
                  {formatRm(balanceNow)}
                </strong>
              </FieldDescription>
            )}
            {error && <FieldError>{t(error)}</FieldError>}
            <DeleteConfirm
              pending={pending}
              showDelete={entry !== undefined}
              question={t("Delete this entry?")}
              asking={asking}
              onAskingChange={setAsking}
              onDelete={remove}
            />
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
