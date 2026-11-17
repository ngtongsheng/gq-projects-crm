"use client";

import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { whatsAppLink } from "@/lib/domain/site-log";
import { useT } from "@/lib/i18n/language-context";
import { customSampleReminderText } from "./custom-sample-reminder";
import type { CustomSample, CustomSampleLoan } from "./custom-sample-types";

type RemindBorrowerButtonProps = {
  sample: Pick<CustomSample, "code" | "designNo" | "designName">;
  loan: CustomSampleLoan;
  borrowerName: string;
  /** The borrower's WhatsApp number from People settings; null when none is on file. */
  borrowerWhatsApp: string | null;
  /** The sheet spells out who is reminded; the table row only says "Remind". */
  withName?: boolean;
};

/** Opens WhatsApp with the reminder text ready for an overdue loan (demo "Remind"); nothing is sent by the app. */
export function RemindBorrowerButton({
  sample,
  loan,
  borrowerName,
  borrowerWhatsApp,
  withName = false,
}: RemindBorrowerButtonProps) {
  const t = useT();
  const text = customSampleReminderText(sample, loan, borrowerName);
  return (
    <Button asChild size={withName ? "default" : "sm"} variant="outline">
      <a
        href={whatsAppLink(borrowerWhatsApp, text)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          if (!borrowerWhatsApp) {
            toast(
              `${t("No WhatsApp number for")} ${borrowerName} – ${t("add it in People")}`,
            );
          }
        }}
      >
        <MessageCircle />
        {withName ? `${t("WhatsApp")} ${borrowerName}` : t("Remind")}
      </a>
    </Button>
  );
}
