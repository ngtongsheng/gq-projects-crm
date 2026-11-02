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
import { allowedMoves } from "@/lib/domain/mof-stages";
import { changeMofStage } from "./change-stage";
import { type MofStage, MofStageLabel } from "./schemas";

type StageSelectProps = { mofId: string; stage: MofStage };

/** Changes an MOF's stage in place. Only shown to people who may edit the register. */
export function StageSelect({ mofId, stage }: StageSelectProps) {
  const [pending, startTransition] = useTransition();

  const change = (value: string) =>
    startTransition(async () => {
      const result = await changeMofStage(mofId, value);
      if (result.error) toast.error(result.error);
      else if (result.warning) toast.warning(result.warning);
      else toast.success("Stage changed.");
    });

  return (
    <Select value={stage} onValueChange={change} disabled={pending}>
      <SelectTrigger size="sm" aria-label="Stage" className="w-full min-w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {[stage, ...allowedMoves(stage)].map((option) => (
          <SelectItem key={option} value={option}>
            {MofStageLabel[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
