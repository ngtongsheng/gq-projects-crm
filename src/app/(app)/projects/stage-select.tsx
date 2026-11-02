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
import { changeProjectStage } from "./change-stage";
import { ProjectStage, ProjectStageLabel } from "./schemas";

type StageSelectProps = { projectId: string; stage: ProjectStage };

/** Changes a project's stage in place. Only shown to people who may edit the project. */
export function StageSelect({ projectId, stage }: StageSelectProps) {
  const [pending, startTransition] = useTransition();

  const change = (value: string) =>
    startTransition(async () => {
      const result = await changeProjectStage(projectId, value);
      if (result.error) toast.error(result.error);
      else toast.success("Stage changed.");
    });

  return (
    <Select value={stage} onValueChange={change} disabled={pending}>
      <SelectTrigger size="sm" aria-label="Stage" className="w-full min-w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ProjectStage.options.map((option) => (
          <SelectItem key={option} value={option}>
            {ProjectStageLabel[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
