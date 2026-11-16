"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/language-context";
import { waiveLateCut } from "./claim-review-actions";

/** Gives the late-collection cut back on a line whose appeal was approved after it was added. */
export function WaiveLateCutButton({
  claimId,
  mofId,
}: {
  claimId: string;
  mofId: string;
}) {
  const [pending, startTransition] = useTransition();
  const t = useT();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await waiveLateCut(claimId, mofId);
          if (result.error !== null) toast.error(result.error);
          else toast.success(t("Late cut given back."));
        })
      }
    >
      {t("Give back the late cut")}
    </Button>
  );
}
