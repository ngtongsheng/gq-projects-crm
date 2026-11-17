"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/language-context";
import {
  confirmCustomSampleBack,
  markCustomSampleReturned,
  rejectCustomSampleReturn,
} from "./custom-sample-loan-actions";
import { openLoan } from "./custom-sample-status";
import type { CustomSample } from "./custom-sample-types";

type CustomSampleReturnButtonsProps = {
  sample: Pick<CustomSample, "id" | "code" | "givenOn" | "loans">;
  meId: string;
  /** The office (SQL: keeps_custom_samples), who may confirm, or take a sample back in one step. */
  canKeep: boolean;
  /** Name of whoever holds the sample, for the "not received" notice. */
  borrowerName: string;
  size?: "default" | "sm";
};

/**
 * The two-step return (demo tfBtns). The borrower says "I've returned it"; the office confirms
 * or says "Not received". The office also takes any open loan back in one step, even its own.
 */
export function CustomSampleReturnButtons({
  sample,
  meId,
  canKeep,
  borrowerName,
  size = "sm",
}: CustomSampleReturnButtonsProps) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const loan = sample.givenOn === null ? openLoan(sample) : null;
  if (!loan) return null;
  const marked = loan.returnedMarkedOn !== null;

  function run(
    step: (id: string) => Promise<{ error: string | null }>,
    done: string,
  ) {
    startTransition(async () => {
      const result = await step(sample.id);
      if (result.error !== null) toast.error(result.error);
      else toast.success(done);
    });
  }

  if (canKeep) {
    return (
      <>
        <Button
          size={size}
          variant={marked ? "default" : "outline"}
          disabled={pending}
          onClick={() =>
            run(
              confirmCustomSampleBack,
              `${sample.code} ${t("received back – available again")}`,
            )
          }
        >
          {marked ? `✓ ${t("Received back")}` : t("Received back")}
        </Button>
        {marked && (
          <Button
            size={size}
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(
                rejectCustomSampleReturn,
                `${t("Not received")} – ${borrowerName} ${t("still has it, please follow up")}`,
              )
            }
          >
            {t("Not received")}
          </Button>
        )}
      </>
    );
  }
  if (loan.salespersonId !== meId) return null;
  return marked ? (
    <span className="text-xs text-muted-foreground">
      {t("Waiting for designer to confirm")}
    </span>
  ) : (
    <Button
      size={size}
      variant="outline"
      disabled={pending}
      onClick={() =>
        run(
          markCustomSampleReturned,
          t("Thanks – the designer will confirm once received"),
        )
      }
    >
      {t("I've returned it")}
    </Button>
  );
}
