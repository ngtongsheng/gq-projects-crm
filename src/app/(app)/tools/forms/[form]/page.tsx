import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintLayout } from "@/components/app/print-layout";
import { requirePage } from "@/lib/auth/require-page";
import { PRINT_FORM_INFO, parsePrintForm } from "@/lib/domain/print-forms";
import { getT } from "@/lib/i18n/server-t";
import { CommencementForm } from "../commencement-form";
import { loadFormMof } from "../form-mof-data";
import { HandoverForm } from "../handover-form";
import { MeasurementForm } from "../measurement-form";

export const metadata: Metadata = { title: "Form to print" };

/** The name printed at the top right of the sheet; the full name heads the toolbar. */
const SHEET_TITLE = {
  measure: "Measurement summary",
  commence: "Work commencement",
  handover: "Project handover",
} as const;

/** A form on A4, blank or filled from the MOF named in `?mof=`. */
export default async function PrintFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ form: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("tools");
  const t = await getT(me.language);
  const form = parsePrintForm((await params).form);
  if (!form) notFound();
  const mofId = (await searchParams).mof;
  const mof = typeof mofId === "string" ? await loadFormMof(mofId, me) : null;
  if (typeof mofId === "string" && !mof) notFound();

  const info = PRINT_FORM_INFO[form];
  const meta = [
    ...(form === "handover" ? [{ label: "Form no.", value: "HO-01" }] : []),
    ...(mof ? [{ label: "MOF no.", value: mof.mofNo }] : []),
  ];

  return (
    <PrintLayout
      title={SHEET_TITLE[form]}
      toolbarTitle={`${t(info.title)}${mof ? ` · ${mof.mofNo}` : ""}`}
      meta={meta}
      toolbarActions={
        <Link
          href="/tools?view=forms"
          className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted/50"
        >
          {t("Back to forms")}
        </Link>
      }
    >
      {form === "measure" && <MeasurementForm mof={mof} />}
      {form === "commence" && <CommencementForm mof={mof} />}
      {form === "handover" && <HandoverForm mof={mof} />}
    </PrintLayout>
  );
}
