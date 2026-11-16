"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useT } from "@/lib/i18n/language-context";
import { setCommissionLines } from "./commission-line-actions";

/** Ticks one commission line into the claim, or takes it out. */
export function CommissionTick({
  month,
  mofId,
  ticked,
  label,
}: {
  month: string;
  mofId: string;
  ticked: boolean;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Checkbox
      aria-label={label}
      checked={ticked}
      disabled={pending}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          const result = await setCommissionLines(
            month,
            [mofId],
            checked === true,
          );
          if (result.error !== null) toast.error(result.error);
        })
      }
    />
  );
}

/** Ticks every line that can be claimed this month. */
export function TickAllButton({
  month,
  mofIds,
}: {
  month: string;
  mofIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const t = useT();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setCommissionLines(month, mofIds, true);
          if (result.error !== null) toast.error(result.error);
        })
      }
    >
      {t("Tick all")}
    </Button>
  );
}
