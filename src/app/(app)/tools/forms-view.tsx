import { FileText, Paperclip } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PRINT_FORMS } from "@/lib/domain/print-forms";
import type { Translate } from "@/lib/i18n/translate";
import { LeaveSection } from "../leave/leave-section";
import { AddFormLinkDialog } from "./add-form-link-dialog";
import { loadFormLinks } from "./form-link-data";
import { loadMofChoices } from "./forms/form-mof-data";
import { PrintFormRow } from "./print-form-row";
import { RemoveFormLinkButton } from "./remove-form-link-button";

/** Where the Best Link pickup form is opened from; Stock's samples page takes it over when it is built. */
const PICKUP_FORM_HREF = "/stock";

/** The demo's Forms to print view: three A4 forms, the Best Link pickup form, then admin-added Drive links. */
export async function FormsView({
  canAddLinks,
  canOpenStock,
  t,
}: {
  canAddLinks: boolean;
  canOpenStock: boolean;
  t: Translate;
}) {
  const [mofs, links] = await Promise.all([loadMofChoices(), loadFormLinks()]);

  return (
    <LeaveSection
      title={t("Forms to print")}
      note={t("Tap Print – opens on A4, ready to print or save as PDF.")}
      action={canAddLinks ? <AddFormLinkDialog /> : undefined}
    >
      <div className="overflow-hidden rounded-xl border bg-card">
        <ul className="divide-y">
          {PRINT_FORMS.map((form) => (
            <PrintFormRow key={form} form={form} mofs={mofs} />
          ))}
          <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
            <FileText
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="mr-auto min-w-0">
              <p className="font-medium">{t("Best Link sample pickup form")}</p>
              <p className="text-sm text-muted-foreground">
                {t("Filled in from Stock → Samples at Best Link")}
              </p>
            </div>
            {canOpenStock && (
              <Button asChild variant="outline" size="sm">
                <Link href={PICKUP_FORM_HREF}>{t("Open")}</Link>
              </Button>
            )}
          </li>
          {links.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
            >
              <Paperclip
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="mr-auto min-w-0">
                <p className="font-medium">{link.name}</p>
                <p className="text-sm text-muted-foreground">
                  {link.note || t("Google Drive file")}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {t("Open")}
                </a>
              </Button>
              {canAddLinks && <RemoveFormLinkButton id={link.id} />}
            </li>
          ))}
        </ul>
      </div>
    </LeaveSection>
  );
}
