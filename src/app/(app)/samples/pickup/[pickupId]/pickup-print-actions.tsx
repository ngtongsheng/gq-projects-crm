"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markPickupPdfSaved } from "../../pickup-actions";

const link =
  "rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted/50";

/**
 * Screen-only buttons beside Print on a pickup form: back to the list, the Drive folder, the
 * Chinese WhatsApp text to Best Link, and a note that the PDF was saved.
 */
export function PickupPrintActions({
  pickupId,
  whatsAppUrl,
  driveFolderUrl,
  pdfSavedOn,
  canEdit,
}: {
  pickupId: string;
  whatsAppUrl: string;
  driveFolderUrl: string | null;
  /** Already formatted, or null when no PDF was noted yet. */
  pdfSavedOn: string | null;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function notePdfSaved() {
    startTransition(async () => {
      const result = await markPickupPdfSaved(pickupId);
      if (result.error) toast.error(result.error);
      else toast.success("Noted: the PDF is saved.");
    });
  }

  return (
    <>
      <Link href="/samples" className={link}>
        Back
      </Link>
      {driveFolderUrl && (
        <a
          href={driveFolderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={link}
        >
          Drive folder
        </a>
      )}
      <a
        href={whatsAppUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={link}
      >
        WhatsApp Best Link
      </a>
      {canEdit && (
        <Button
          type="button"
          variant="outline"
          onClick={notePdfSaved}
          disabled={pending}
        >
          {pdfSavedOn ? `PDF saved ${pdfSavedOn}` : "I saved the PDF"}
        </Button>
      )}
    </>
  );
}
