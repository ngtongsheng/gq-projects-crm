"use client";

import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { formatRm, parseRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import { ClaimPrintButton } from "./claim-print-button";
import { submitTravelClaim } from "./travel-claim-actions";
import type { TravelClaim } from "./travel-claim-data";
import { travelClaimTotal } from "./travel-claim-input";

export type TravelClaimHints = {
  /** HR's monthly petrol, parking and toll limit; null when none is set. */
  monthlyCap: number | null;
  meals: { breakfast: number; lunch: number; dinner: number } | null;
  hotelBudget: number | null;
};

const show = (value: number | null) => (value === null ? "" : String(value));
const keyed = (text: string) => parseRm(text) ?? 0;

/** The claim month's form: the five totals, the live total, Submit or Update, and Print. */
export function TravelClaimForm({
  month,
  claim,
  claimsOvertime,
  hints,
  children,
}: {
  month: string;
  claim: TravelClaim | null;
  claimsOvertime: boolean;
  hints: TravelClaimHints;
  /** What the server knows: Jany's final amount and note, the report line. */
  children: ReactNode;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [amounts, setAmounts] = useState({
    petrolParkingToll: show(claim?.petrolParkingToll ?? null),
    outstation: show(claim?.outstation ?? null),
    hotel: show(claim?.hotel ?? null),
    others: show(claim?.others ?? null),
    overtime: show(claim?.overtime ?? null),
  });
  const released = claim?.status === "released";
  const submitted = claim?.status === "submitted";
  const petrol = keyed(amounts.petrolParkingToll);
  const total = travelClaimTotal({
    petrolParkingToll: petrol,
    outstation: keyed(amounts.outstation),
    hotel: keyed(amounts.hotel),
    others: keyed(amounts.others),
    overtime: keyed(amounts.overtime),
  });

  const amountField = (key: keyof typeof amounts) => ({
    id: key,
    name: key,
    type: "number" as const,
    min: 0,
    step: 0.01,
    inputMode: "decimal" as const,
    value: amounts[key],
    onChange: (event: { target: { value: string } }) =>
      setAmounts((current) => ({ ...current, [key]: event.target.value })),
  });

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await submitTravelClaim(formData);
      if (result.error !== null) {
        toast.error(t(result.error));
        return;
      }
      toast.success(
        result.updated
          ? t("Claim updated")
          : t("Submitted to Jany – print the form and attach the receipts"),
      );
    });
  }

  return (
    <form
      onSubmit={submitKeepingValues((formData) => save(formData))}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="month" value={month} />
      <fieldset disabled={released} className="flex min-w-0 flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="petrolParkingToll">
              {t("Petrol + parking + toll (TNG) total (RM)")}
            </FieldLabel>
            <Input {...amountField("petrolParkingToll")} />
          </Field>
          <Field>
            <FieldLabel>{t("Entitlement")}</FieldLabel>
            <p className="py-1.5 text-sm">
              {hints.monthlyCap === null ? (
                <span className="text-muted-foreground">
                  {t("Not set – Jany sets it in HR")}
                </span>
              ) : (
                <>
                  {t("up to")}{" "}
                  <b className="font-mono tabular-nums">
                    {formatRm(hints.monthlyCap)}
                  </b>{" "}
                  {t("a month")}
                  {petrol > hints.monthlyCap && (
                    <>
                      {" · "}
                      <b className="font-mono text-bad tabular-nums">
                        {t("over by")} {formatRm(petrol - hints.monthlyCap)}
                      </b>
                    </>
                  )}
                </>
              )}
            </p>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="outstation">
              {t("Outstation allowance total (RM)")}
            </FieldLabel>
            <Input {...amountField("outstation")} />
            {hints.meals && (
              <FieldDescription>
                {t("Breakfast")} {formatRm(hints.meals.breakfast)} ·{" "}
                {t("lunch")} {formatRm(hints.meals.lunch)} · {t("dinner")}{" "}
                {formatRm(hints.meals.dinner)} {t("a day")}
              </FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="hotel">
              {t("Accommodation – hotel total (RM)")}
            </FieldLabel>
            <Input {...amountField("hotel")} />
            {hints.hotelBudget !== null && (
              <FieldDescription>
                {t("Your budget: up to")} {formatRm(hints.hotelBudget)}{" "}
                {t("a night")}
              </FieldDescription>
            )}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="others">
              {t("Others – bought for the company (RM)")}
            </FieldLabel>
            <Input {...amountField("others")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="othersDescription">
              {t("What was bought")}
            </FieldLabel>
            <Input
              id="othersDescription"
              name="othersDescription"
              maxLength={300}
              defaultValue={claim?.othersDescription ?? ""}
              placeholder={t("e.g. adhesive for P1600 site")}
            />
          </Field>
        </div>
        {claimsOvertime && (
          <Field>
            <FieldLabel htmlFor="overtime">
              {t("Overtime – approved OT claim (RM)")}
            </FieldLabel>
            <Input {...amountField("overtime")} />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="remark">{t("Remark")}</FieldLabel>
          <Textarea
            id="remark"
            name="remark"
            rows={2}
            maxLength={1000}
            defaultValue={claim?.remark ?? ""}
            placeholder={t(
              "Anything Jany should know – outstation trips, why over the entitlement, etc.",
            )}
          />
        </Field>
      </fieldset>

      <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
        <span>{t("Total claim")}</span>
        <b className="font-mono text-xl tabular-nums">{formatRm(total)}</b>
      </div>

      {children}

      <div className="flex flex-wrap items-center gap-3">
        {!released && (
          <Button type="submit" disabled={pending}>
            {pending
              ? t("Submitting...")
              : submitted
                ? t("Update")
                : t("Save & submit to Jany")}
          </Button>
        )}
        {claim && <ClaimPrintButton label={t("Print claim form")} />}
      </div>
    </form>
  );
}
