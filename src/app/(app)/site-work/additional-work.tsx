"use client";

import { BellRing } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SITE_STAGE_LABEL } from "@/lib/domain/site-stage";
import { formatDate, todayMyt } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { noteAdditionalWork } from "./additional-work-actions";
import type { AdditionalWorkAlert } from "./additional-work-data";

function NotedButton({ alertId }: { alertId: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await noteAdditionalWork(alertId);
          if (result.error) toast.error(result.error);
        })
      }
    >
      {t("OK, noted")}
    </Button>
  );
}

/** A reopened job's additional work, shown to each supervisor told until they note it. */
export function AdditionalWorkAlerts({
  alerts,
}: {
  /** Each with the name of who reopened the job. */
  alerts: (AdditionalWorkAlert & { by: string })[];
}) {
  const t = useT();
  if (alerts.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex flex-col gap-3 rounded-xl border bg-warn-bg p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <p className="flex items-center gap-2 font-medium text-warn">
              <BellRing className="size-4 shrink-0" aria-hidden />
              <span>
                {t("Additional work")} ·{" "}
                <Link
                  href={`/site-work/${alert.mofId}`}
                  className="font-mono underline-offset-2 hover:underline"
                >
                  {alert.mofNo}
                </Link>{" "}
                · {alert.projectName}
              </span>
            </p>
            <p>
              {alert.voNo}: {alert.description}
              {alert.qty && ` · ${alert.qty}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("Job set back to")} {SITE_STAGE_LABEL.installation} ·{" "}
              {alert.by} · {formatDate(todayMyt(new Date(alert.createdAt)))}
            </p>
          </div>
          <NotedButton alertId={alert.id} />
        </div>
      ))}
    </div>
  );
}
