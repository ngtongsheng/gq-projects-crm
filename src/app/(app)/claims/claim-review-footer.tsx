"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ClaimStep } from "@/lib/domain/claim-flow";
import { formatRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import { approveClaim, checkClaim, payClaim } from "./actions";
import { ClaimBanner } from "./claim-banner";
import { ClaimReturnDialog } from "./claim-return-dialog";
import { saveClaimReview } from "./claim-review-actions";
import { ClaimAmountInput, useClaimReview } from "./claim-review-state";

const TAKE = {
  check: checkClaim,
  approve: approveClaim,
  pay: payClaim,
} as const;
const DONE: Record<keyof typeof TAKE, string> = {
  check: "Checked. Sent to the MD to approve.",
  approve: "Claim approved.",
  pay: "Marked paid.",
};

/**
 * The foot of the claim sheet: the OT amount, the live total, the reason, remark and
 * original-receipts tick, and the steps the viewer may take. Steps save what was typed first,
 * so a remark written for a flagged claim is there when the step looks for it.
 */
export function ClaimReviewFooter({
  claimId,
  personName,
  adjustable,
  steps,
  originalTotal,
  existingRemark,
  receiptCount,
  ot,
  payBlock,
  backHref,
}: {
  claimId: string;
  personName: string;
  adjustable: boolean;
  steps: ClaimStep[];
  originalTotal: number;
  /** Shown to a viewer who cannot change it. */
  existingRemark: string;
  receiptCount: number;
  ot: { hours: number; estimate: number | null } | null;
  /** Why an approved claim cannot be paid yet, or null. */
  payBlock: string | null;
  backHref: string;
}) {
  const state = useClaimReview();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useT();
  const adjustedNow = Math.abs(state.total - originalTotal) >= 0.005;

  async function persist(): Promise<boolean> {
    if (!adjustable) return true;
    const result = await saveClaimReview(claimId, {
      lines: state.changedLines,
      reason: state.reason,
      remark: state.remark,
      originalReceiptsReceived: state.originalReceiptsReceived,
    });
    if (result.error !== null) toast.error(result.error);
    return result.error === null;
  }

  function save() {
    startTransition(async () => {
      if (!(await persist())) return;
      toast.success(t("Saved."));
      router.refresh();
    });
  }

  function take(step: keyof typeof TAKE) {
    startTransition(async () => {
      if (!(await persist())) return;
      const result = await TAKE[step](claimId);
      if (result.error !== null) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success(t(DONE[step]));
      router.push(backHref);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {adjustable && ot && (
        <Field className="max-w-xs">
          <FieldLabel>
            {t("OT amount (RM) for")} {ot.hours} {t("approved hours")}
          </FieldLabel>
          <ClaimAmountInput kind="ot" id={claimId} label={t("OT amount")} />
          {ot.estimate !== null && ot.estimate > 0 && (
            <FieldDescription>
              {t("Estimate")} {formatRm(ot.estimate)} = {t("basic")} ÷ 26 ÷ 8 ×
              1.5
            </FieldDescription>
          )}
        </Field>
      )}

      <p className="text-right text-sm font-semibold">
        {t("Total claim")}{" "}
        <span className="font-mono tabular-nums">{formatRm(state.total)}</span>
      </p>
      {adjustedNow && (
        <ClaimBanner tone="warn">
          {t("Original claim")} <b>{formatRm(originalTotal)}</b> →{" "}
          {t("final approved amount")} <b>{formatRm(state.total)}</b>
        </ClaimBanner>
      )}

      {adjustable ? (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          {state.changedLines.length > 0 && (
            <Field>
              <FieldLabel htmlFor="review-reason">
                {t("Reason for adjustment")} *
              </FieldLabel>
              <Input
                id="review-reason"
                maxLength={300}
                value={state.reason}
                onChange={(event) => state.setReason(event.target.value)}
                placeholder={t(
                  "e.g. Parking receipt RM8 is for personal shopping, not claimable",
                )}
              />
              <FieldDescription>
                {personName} {t("sees this under the line.")}
              </FieldDescription>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="review-remark">
              {t("Remark to")} {personName}
            </FieldLabel>
            <Textarea
              id="review-remark"
              rows={2}
              maxLength={1000}
              value={state.remark}
              onChange={(event) => state.setRemark(event.target.value)}
              placeholder={t(
                "e.g. Received original receipts. Next time please write the client name on the toll receipt.",
              )}
            />
            <FieldDescription>
              {t("They see this on their claim.")}
            </FieldDescription>
          </Field>
          {receiptCount > 0 && (
            <Field orientation="horizontal">
              <Checkbox
                id="review-originals"
                checked={state.originalReceiptsReceived}
                onCheckedChange={(checked) =>
                  state.setOriginalReceiptsReceived(checked === true)
                }
              />
              <FieldLabel htmlFor="review-originals">
                {t("Original receipts received")} ({receiptCount}: R1
                {receiptCount > 1 ? `–R${receiptCount}` : ""}){" "}
                {t("with the signed claim form")}
              </FieldLabel>
            </Field>
          )}
        </div>
      ) : (
        existingRemark && (
          <ClaimBanner tone="info">
            <b>{t("Remark")}:</b> {existingRemark}
          </ClaimBanner>
        )
      )}

      <div className="flex flex-wrap items-center gap-2">
        {steps.includes("return") && (
          <ClaimReturnDialog
            claimId={claimId}
            personName={personName}
            disabled={pending}
            onReturned={() => router.push(backHref)}
          />
        )}
        {adjustable && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={save}
          >
            {t("Save changes")}
          </Button>
        )}
        {steps.includes("check") && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => take("check")}
          >
            {t("Pass to the MD")}
          </Button>
        )}
        {steps.includes("approve") && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => take("approve")}
          >
            {t("Approve")}
          </Button>
        )}
        {steps.includes("pay") &&
          (payBlock ? (
            <span className="text-sm text-muted-foreground">{payBlock}</span>
          ) : (
            <Button
              type="button"
              disabled={pending}
              onClick={() => take("pay")}
            >
              {t("Mark paid")}
            </Button>
          ))}
      </div>
    </div>
  );
}
