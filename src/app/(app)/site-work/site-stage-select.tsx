"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SITE_STAGE_LABEL,
  SITE_STAGES,
  type SiteStage,
  siteStagePercent,
} from "@/lib/domain/site-stage";
import { setSiteStage } from "./actions";

/** Moves the site to another stage; any stage can be picked so a mistake can be undone. */
export function SiteStageSelect({
  mofId,
  stage,
}: {
  mofId: string;
  stage: SiteStage;
}) {
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    const parsed = SITE_STAGES.find((value) => value === next);
    if (!parsed || parsed === stage) return;
    startTransition(async () => {
      const result = await setSiteStage(mofId, parsed);
      if (result.error) toast.error(result.error);
      else toast.success(`Site stage set to ${SITE_STAGE_LABEL[parsed]}.`);
    });
  }

  return (
    <Select value={stage} onValueChange={change} disabled={pending}>
      <SelectTrigger aria-label="Site stage" className="w-full sm:w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SITE_STAGES.map((value) => (
          <SelectItem key={value} value={value}>
            {SITE_STAGE_LABEL[value]} ({siteStagePercent(value)}%)
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
