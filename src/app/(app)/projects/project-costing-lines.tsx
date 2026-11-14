"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { formatRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import type { ProjectCostingLine } from "../costing/project-costing-data";
import { QUOTE_STATUS_TONE, QuoteStatusLabel } from "../costing/quote-status";
import { setValueFromCosting } from "../costing/use-as-project-value-action";

function UseAsValueButton({
  projectId,
  quoteId,
  amount,
}: {
  projectId: string;
  quoteId: string;
  amount: number;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const use = () =>
    startTransition(async () => {
      const result = await setValueFromCosting({ projectId, quoteId });
      if (result.error) toast.error(t(result.error));
      else toast.success(t("Project value updated."));
    });
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto p-0 text-xs"
      disabled={pending}
      onClick={use}
    >
      {t("Use")} {formatRm(amount)} {t("as project value")}
    </Button>
  );
}

/** The costings linked to a project: status, each option's total, and the way into the costing. */
export function ProjectCostingLines({
  projectId,
  lines,
}: {
  projectId: string;
  lines: ProjectCostingLine[];
}) {
  const t = useT();
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 border-t pt-2">
      <h3 className="text-xs font-semibold">
        {t("Costing")} ({lines.length})
      </h3>
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line.quoteId} className="flex flex-col gap-0.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono font-medium">{line.quoteNo}</span>
              <StatusBadge tone={QUOTE_STATUS_TONE[line.status]}>
                {t(QuoteStatusLabel[line.status])}
              </StatusBadge>
            </div>
            <p className="font-mono tabular-nums">
              {line.options.length > 1
                ? line.options
                    .map((option) => `${option.key} ${formatRm(option.sell)}`)
                    .join(" / ")
                : formatRm(line.options[0]?.sell ?? 0)}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
              <span>{line.salespersonName}</span>
              {line.useAsValue !== null && (
                <UseAsValueButton
                  projectId={projectId}
                  quoteId={line.quoteId}
                  amount={line.useAsValue}
                />
              )}
              <Link
                href={`/costing/${line.quoteId}`}
                className="text-foreground underline-offset-2 hover:underline"
              >
                {t("Open costing")}
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
