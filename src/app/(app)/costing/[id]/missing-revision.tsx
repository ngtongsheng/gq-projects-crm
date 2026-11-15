"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/language-context";
import { startOriginalRevision } from "./revision-actions";

/** A quote whose first insert worked but whose draft revision did not: offers to create the draft. */
export function MissingRevision({
  quoteId,
  salespersonName,
  canStart,
}: {
  quoteId: string;
  salespersonName: string;
  canStart: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      const result = await startOriginalRevision({ quoteId });
      if (result.error) {
        toast.error(t(result.error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6">
      <p className="text-sm">
        {t("This costing was not fully started, so it has no draft yet.")}{" "}
        {canStart
          ? t("Create the draft to start adding products.")
          : `${salespersonName} ${t("can create the draft by opening it.")}`}
      </p>
      {canStart && (
        <Button type="button" onClick={start} disabled={pending}>
          {pending ? t("Creating...") : t("Create the draft")}
        </Button>
      )}
    </div>
  );
}
