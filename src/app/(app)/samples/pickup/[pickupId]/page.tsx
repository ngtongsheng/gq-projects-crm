import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PrintLayout } from "@/components/app/print-layout";
import { canEditSamples } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { pickupWhatsAppText, whatsAppLink } from "@/lib/domain/pickup-message";
import { formatPickupNo } from "@/lib/domain/samples";
import { formatDate, todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import { loadPickupForm, loadPickupSettings } from "../../samples-data";
import { PickupPrintActions } from "./pickup-print-actions";
import { PickupReceiptSheet } from "./pickup-receipt-sheet";

export const metadata: Metadata = { title: "Pickup form" };

/** A Best Link pickup form as "V-GQ SIGNATURE RECEIPT" on A4, with the Chinese WhatsApp text. */
export default async function PickupFormPage({
  params,
}: {
  params: Promise<{ pickupId: string }>;
}) {
  const me = await requirePage("stock");
  const t = await getT(me.language);
  const { pickupId } = await params;
  if (!z.uuid().safeParse(pickupId).success) notFound();
  const [form, settings] = await Promise.all([
    loadPickupForm(pickupId),
    loadPickupSettings(),
  ]);
  if (!form) notFound();

  const number = formatPickupNo(form.runningNo);
  const appointmentOn = formatDate(form.appointmentOn);
  const formDate = formatDate(form.formDate);
  const whatsAppUrl = whatsAppLink(
    settings.bestLinkWhatsapp,
    pickupWhatsAppText({
      runningNo: form.runningNo,
      appointmentOn,
      method: form.method,
      personInCharge: form.personInCharge,
      contact: form.contact,
      driverContact: form.driverContact,
      vehicleNo: form.vehicleNo,
      lines: form.lines,
    }),
  );
  const canEdit = canEditSamples(me);

  return (
    <PrintLayout
      title={t("V-GQ Signature Receipt")}
      toolbarTitle={`${t("Pickup form")} ${number}`}
      meta={[
        { label: t("Form no."), value: number },
        { label: t("Date"), value: formDate },
      ]}
      toolbarActions={
        <PickupPrintActions
          pickupId={form.id}
          whatsAppUrl={whatsAppUrl}
          driveFolderUrl={settings.driveFolderUrl}
          pdfSavedOn={
            form.pdfSavedAt
              ? formatDate(todayMyt(new Date(form.pdfSavedAt)))
              : null
          }
          canEdit={canEdit}
        />
      }
      notice={
        <div className="rounded-lg border bg-card px-3 py-2 text-sm">
          <b>{t("On the phone:")}</b>{" "}
          {t(
            "Print / Save as PDF, then share it to WhatsApp (Best Link) or Drive.",
          )}
          <br />
          <b>{t("On the computer:")}</b>{" "}
          {t(
            "Print / Save as PDF, upload it to the Drive folder and drag it into WhatsApp Web. WhatsApp Best Link sends the Chinese message.",
          )}
          {!settings.bestLinkWhatsapp && (
            <>
              {" "}
              <span className="text-warn">
                {t(
                  "No Best Link number is saved, so WhatsApp asks you to pick the chat. Add it under Settings on the Samples page.",
                )}
              </span>
            </>
          )}
        </div>
      }
    >
      <PickupReceiptSheet
        form={form}
        formDate={formDate}
        appointmentOn={appointmentOn}
      />
    </PrintLayout>
  );
}
