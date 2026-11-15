"use client";

import { Check, Send, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/language-context";
import type { SiteWorkResult } from "./actions";
import {
  cancelShootRequest,
  markPhotosPosted,
  receiveMeasurement,
} from "./measurement-photo-actions";

/** Runs one server action from a button and shows its refusal as a toast. */
function useRowAction(run: () => Promise<SiteWorkResult>) {
  const [pending, startTransition] = useTransition();
  const act = () =>
    startTransition(async () => {
      const result = await run();
      if (result.error) toast.error(result.error);
    });
  return { pending, act };
}

/** The salesperson taps Received once the measurement has reached them. */
export function ReceivedButton({ siteLogId }: { siteLogId: string }) {
  const t = useT();
  const { pending, act } = useRowAction(() => receiveMeasurement(siteLogId));
  return (
    <Button size="sm" disabled={pending} onClick={act}>
      <Check data-icon="inline-start" />
      {t("Received")}
    </Button>
  );
}

/** The supervisor says the photos are now in the job's WhatsApp group. */
export function PostedNowButton({ siteLogId }: { siteLogId: string }) {
  const t = useT();
  const { pending, act } = useRowAction(() => markPhotosPosted(siteLogId));
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={act}>
      <Send data-icon="inline-start" />
      {t("Posted now")}
    </Button>
  );
}

export function CancelRequestButton({
  requestId,
  createdById,
}: {
  requestId: string;
  createdById: string;
}) {
  const t = useT();
  const { pending, act } = useRowAction(() =>
    cancelShootRequest(requestId, createdById),
  );
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={act}>
      <X data-icon="inline-start" />
      {t("Cancel")}
    </Button>
  );
}
