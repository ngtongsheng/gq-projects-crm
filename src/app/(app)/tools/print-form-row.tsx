"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRINT_FORM_INFO, type PrintForm } from "@/lib/domain/print-forms";
import { useT } from "@/lib/i18n/language-context";
import type { MofChoice } from "./forms/form-mof-data";

const BLANK = "blank";

/** One printable form: blank, or filled from an awarded MOF picked beside it. */
export function PrintFormRow({
  form,
  mofs,
}: {
  form: PrintForm;
  mofs: MofChoice[];
}) {
  const t = useT();
  const [mofId, setMofId] = useState(BLANK);
  const info = PRINT_FORM_INFO[form];
  const href =
    mofId === BLANK
      ? `/tools/forms/${form}`
      : `/tools/forms/${form}?mof=${mofId}`;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="mr-auto min-w-0 flex-1 basis-60">
        <p className="font-medium">{t(info.title)}</p>
        <p className="text-sm text-muted-foreground">{t(info.summary)}</p>
      </div>
      <Select value={mofId} onValueChange={setMofId}>
        <SelectTrigger
          aria-label={`${t("Fill from MOF")}: ${t(info.title)}`}
          className="w-full sm:w-56"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={BLANK}>{t("Blank form")}</SelectItem>
          {mofs.map((mof) => (
            <SelectItem key={mof.id} value={mof.id}>
              {mof.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button asChild size="sm">
        <Link href={href}>{t("Print")}</Link>
      </Button>
    </li>
  );
}
