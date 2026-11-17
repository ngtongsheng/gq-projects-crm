"use client";

import { Upload } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/language-context";
import {
  type ImportResult,
  importMarketingExcel,
} from "./marketing-excel-actions";
import { MAX_IMPORT_BYTES } from "./marketing-excel-layout";

/** Imports an Excel file into the expense log, events, prepaid accounts and give-aways (demo sheetMkImp). */
export function MarketingExcelImportDialog() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(true);
  const [refusal, setRefusal] = useState<ImportResult | null>(null);

  function openChanged(next: boolean) {
    setOpen(next);
    if (!next) return;
    setFile(null);
    setReplace(true);
    setRefusal(null);
  }

  function submit() {
    if (!file) {
      setRefusal(refused("Choose the Excel file to import."));
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setRefusal(refused("That file is too big. Keep it under 1 MB."));
      return;
    }
    const form = new FormData();
    form.set("file", file);
    form.set("replace", String(replace));
    startTransition(async () => {
      const result = await importMarketingExcel(form);
      if (result.error !== null || result.counts === null) {
        setRefusal(result);
        return;
      }
      const { expenses, costs, prepaid, giveaways } = result.counts;
      toast.success(
        `${t("Imported")} ${expenses + costs + prepaid + giveaways} ${t("lines")}`,
      );
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={openChanged}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload data-icon="inline-start" />
          {t("Import Excel")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Import Excel")}</DialogTitle>
          <DialogDescription>
            {t(
              "Pick an Excel (.xlsx) file with the expense log, event cost sheets, prepaid accounts or sample give-aways. The whole file is checked first; if a row is wrong, nothing is imported.",
            )}
          </DialogDescription>
        </DialogHeader>
        <Input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label={t("Excel file")}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <Label className="gap-2 font-normal">
          <Checkbox
            checked={replace}
            onCheckedChange={(checked) => setReplace(checked === true)}
          />
          {t("Replace what is in the app now (untick to add on top)")}
        </Label>
        {refusal?.error && (
          <div className="flex flex-col gap-1">
            <FieldError>{t(refusal.error)}</FieldError>
            {refusal.problems.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {refusal.problems.map((problem) => (
                  <li
                    key={`${problem.sheet}|${problem.row}|${problem.message}`}
                  >
                    {problem.sheet}
                    {problem.row !== null && `, ${t("row")} ${problem.row}`}:{" "}
                    {t(problem.message)}
                  </li>
                ))}
                {refusal.problemCount > refusal.problems.length && (
                  <li>
                    {t("and")} {refusal.problemCount - refusal.problems.length}{" "}
                    {t("more")}
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? t("Importing...") : t("Import")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

const refused = (error: string): ImportResult => ({
  error,
  problems: [],
  problemCount: 0,
  counts: null,
});
