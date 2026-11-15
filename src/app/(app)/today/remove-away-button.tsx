"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/language-context";
import { removeSiteOff } from "./away-actions";

/** Takes an office or other day back out, for a day marked by mistake. */
export function RemoveAwayButton({ id }: { id: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await removeSiteOff(id);
          if (result.error) toast.error(result.error);
        })
      }
    >
      {t("Remove")}
    </Button>
  );
}
