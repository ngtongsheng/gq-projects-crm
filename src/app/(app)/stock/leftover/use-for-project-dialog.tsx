"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEFTOVER_UNIT_LABEL,
  type LeftoverUnit,
  leftoverAllocationProblem,
} from "@/lib/domain/leftover";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { todayMyt } from "@/lib/format/date";
import { formatQuantity } from "@/lib/format/quantity";
import { useT } from "@/lib/i18n/language-context";
import { allocateLeftover } from "./allocation-actions";

/** Gives some of the stock GQ keeps at Best Link to another project (the demo's "Use for project"). */
export function UseForProjectDialog({
  leftoverId,
  item,
  unit,
  available,
  projects,
}: {
  leftoverId: string;
  item: string;
  unit: LeftoverUnit;
  available: number;
  projects: { id: string; label: string }[];
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");

  function save(formData: FormData) {
    const qty = Number(formData.get("qty"));
    const problem = leftoverAllocationProblem(qty, available, unit);
    if (problem) {
      setError(problem);
      return;
    }
    startTransition(async () => {
      const result = await allocateLeftover(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(t("Leftover stock used for the project."));
        setOpen(false);
        setProjectId("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{t("Use for project")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Use leftover stock")}</DialogTitle>
          <DialogDescription>
            {item} · {formatQuantity(available)} {t(LEFTOVER_UNIT_LABEL[unit])}{" "}
            {t("available at Best Link")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="leftoverId" value={leftoverId} />
          <input type="hidden" name="projectId" value={projectId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`use-project-${leftoverId}`}>
                {t("For project")}
              </FieldLabel>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id={`use-project-${leftoverId}`}>
                  <SelectValue placeholder={t("Choose the project")} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`use-qty-${leftoverId}`}>
                  {t("Quantity (")}
                  {t(LEFTOVER_UNIT_LABEL[unit])})
                </FieldLabel>
                <Input
                  id={`use-qty-${leftoverId}`}
                  name="qty"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={available}
                  step="0.01"
                  defaultValue={available}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`use-date-${leftoverId}`}>
                  {t("Date")}
                </FieldLabel>
                <Input
                  id={`use-date-${leftoverId}`}
                  name="usedOn"
                  type="date"
                  defaultValue={todayMyt()}
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`use-note-${leftoverId}`}>
                {t("Note")}
              </FieldLabel>
              <Input
                id={`use-note-${leftoverId}`}
                name="note"
                maxLength={300}
                placeholder={t("e.g. Sold at RM 18 per box, delivered with DO")}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving...") : t("Save")}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
