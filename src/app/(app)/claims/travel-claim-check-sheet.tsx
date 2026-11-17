"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import type { TravelClaimListRow } from "./all-claims-data";
import { ClaimBanner } from "./claim-banner";
import { ClaimPrintButton } from "./claim-print-button";
import { travelClaimTotal } from "./travel-claim-input";
import type { TravelClaimReviewResult } from "./travel-claim-review-actions";
import {
  releaseTravelClaim,
  returnTravelClaim,
  saveTravelClaimCheck,
} from "./travel-claim-review-actions";

type Step = typeof saveTravelClaimCheck;

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-mono tabular-nums">{children}</dd>
    </>
  );
}

/**
 * The demo's check sheet for a submitted claim: what was claimed, the final amount, Jany's note
 * and the Vicky tick, then Return, Save or Release. Release waits for the monthly report and
 * warns once when Vicky has not verified it (demo confirm0).
 */
export function TravelClaimCheckSheet({
  row,
  monthLabel,
  closeHref,
}: {
  row: TravelClaimListRow & { claim: NonNullable<TravelClaimListRow["claim"]> };
  /** "Nov 2026". */
  monthLabel: string;
  closeHref: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { claim } = row;
  const total = travelClaimTotal(claim);
  const released = claim.status === "released";
  const [finalAmount, setFinalAmount] = useState(
    String(claim.finalAmount ?? total),
  );
  const [note, setNote] = useState(claim.finalNote ?? "");
  const [verified, setVerified] = useState(claim.verifiedWithVickyOn !== null);
  const [warned, setWarned] = useState(false);

  function run(step: Step, done: string, close: boolean) {
    startTransition(async () => {
      const body = new FormData();
      body.set("finalAmount", finalAmount);
      body.set("finalNote", note);
      if (verified) body.set("verifiedWithVicky", "on");
      const result: TravelClaimReviewResult = await step(claim.id, body);
      if (result.error !== null) {
        toast.error(t(result.error));
        return;
      }
      toast.success(done);
      if (close) router.replace(closeHref, { scroll: false });
    });
  }

  function release() {
    if (!verified && !warned) {
      setWarned(true);
      return;
    }
    run(releaseTravelClaim, t("Claim released"), true);
  }

  const over =
    row.monthlyLimit !== null &&
    (claim.petrolParkingToll ?? 0) > row.monthlyLimit;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) router.replace(closeHref, { scroll: false });
      }}
    >
      <SheetContent className="print:hidden data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="pr-12">
          <SheetTitle className="text-lg">
            {row.name} · {monthLabel}
          </SheetTitle>
          <SheetDescription>
            {claim.submittedOn &&
              `${t("Submitted")} ${formatDate(claim.submittedOn)}`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
          <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-2 text-sm">
            <Line label={t("Petrol + parking + toll (TNG)")}>
              {formatRm(claim.petrolParkingToll ?? 0)}
              {row.monthlyLimit !== null && (
                <span className="block text-xs font-normal text-muted-foreground">
                  {t("entitlement")} {formatRm(row.monthlyLimit)}
                  {over && (
                    <b className="text-bad">
                      {" · "}
                      {t("over by")}{" "}
                      {formatRm(
                        (claim.petrolParkingToll ?? 0) -
                          (row.monthlyLimit ?? 0),
                      )}
                    </b>
                  )}
                </span>
              )}
            </Line>
            <Line label={t("Outstation allowance (meals)")}>
              {formatRm(claim.outstation ?? 0)}
            </Line>
            <Line label={t("Accommodation (hotel)")}>
              {formatRm(claim.hotel ?? 0)}
            </Line>
            <Line label={t("Others – bought for the company")}>
              {formatRm(claim.others ?? 0)}
              {claim.othersDescription && (
                <span className="block text-xs font-normal text-muted-foreground">
                  {claim.othersDescription}
                </span>
              )}
            </Line>
            {(claim.overtime ?? 0) > 0 && (
              <Line label={t("Overtime (approved OT)")}>
                {formatRm(claim.overtime ?? 0)}
              </Line>
            )}
            <dt className="border-t pt-2 font-semibold">
              {t("Total claimed")}
            </dt>
            <dd className="border-t pt-2 text-right font-mono font-semibold tabular-nums">
              {formatRm(total)}
            </dd>
          </dl>

          {claim.remark && (
            <ClaimBanner tone="info">
              <b>{t("Remark")}:</b> {claim.remark}
            </ClaimBanner>
          )}

          <fieldset disabled={released} className="flex min-w-0 flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="finalAmount">
                {t("Final amount to pay (RM)")}
              </FieldLabel>
              <Input
                id="finalAmount"
                type="number"
                min={0}
                step={0.01}
                inputMode="decimal"
                value={finalAmount}
                onChange={(event) => setFinalAmount(event.target.value)}
              />
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="verifiedWithVicky"
                checked={verified}
                onCheckedChange={(checked) => {
                  setVerified(checked === true);
                  setWarned(false);
                }}
              />
              <FieldLabel htmlFor="verifiedWithVicky">
                {t("Verified with Vicky")}
              </FieldLabel>
            </Field>
            <Field>
              <FieldLabel htmlFor="finalNote">
                {t("Jany's note (shown to the person)")}
              </FieldLabel>
              <Textarea
                id="finalNote"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          </fieldset>

          {row.filesReport && !released && (
            <ClaimBanner tone={row.reportIsIn ? "info" : "warn"}>
              {t("Monthly report")} {monthLabel}:{" "}
              {row.reportIsIn
                ? t("can release")
                : t("hold the claim until it is submitted")}
            </ClaimBanner>
          )}
          {warned && !verified && (
            <p role="alert" className="text-sm text-bad">
              {t(
                "Not yet verified with Vicky. Tap Release again to release anyway.",
              )}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {released ? (
              <StatusBadge tone="good">
                {t("Released")}
                {claim.releasedOn && ` ${formatDate(claim.releasedOn)}`}
                {row.releasedByName && ` ${t("by")} ${row.releasedByName}`}
              </StatusBadge>
            ) : (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    run(
                      returnTravelClaim,
                      `${t("Returned to")} ${row.name}`,
                      true,
                    )
                  }
                >
                  {t("Return")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(saveTravelClaimCheck, t("Saved"), false)}
                >
                  {t("Save")}
                </Button>
                <Button
                  type="button"
                  disabled={pending || !row.reportIsIn}
                  onClick={release}
                >
                  {t("Release claim")}
                </Button>
              </>
            )}
            <span className="ml-auto">
              <ClaimPrintButton label={t("Print claim form")} />
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
