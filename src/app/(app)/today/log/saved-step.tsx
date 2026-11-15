"use client";

import { CircleCheck, MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SITE_STAGE_LABEL, type SiteStage } from "@/lib/domain/site-stage";
import { useT } from "@/lib/i18n/language-context";

export type SavedVisit = {
  siteLabel: string;
  monthVisits: number;
  movedTo: SiteStage | null;
  /** The balance stock text for the office, with its WhatsApp link; null when none was left. */
  stockReturn: { text: string; href: string; isReturn: boolean } | null;
};

/** Step 4: saved, with the WhatsApp message for the office when balance stock is on its way back. */
export function SavedStep({
  saved,
  target,
  doneHref,
  onAnother,
}: {
  saved: SavedVisit;
  target: number;
  doneHref: string;
  onAnother: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <CircleCheck aria-hidden className="size-14 text-good" />
        <h2 className="font-heading text-2xl font-semibold">{t("Saved!")}</h2>
        <p className="font-medium">{saved.siteLabel}</p>
        {saved.movedTo && (
          <p className="text-sm text-muted-foreground">
            {t("Site stage is now")} {t(SITE_STAGE_LABEL[saved.movedTo])}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {t("This month")}:{" "}
          <span className="font-mono font-semibold tabular-nums">
            {saved.monthVisits} / {target}
          </span>{" "}
          {t("site visits")}
        </p>
      </div>
      {saved.stockReturn && (
        <section className="flex flex-col gap-3 rounded-xl border bg-warn-bg p-4 text-warn">
          <h3 className="font-semibold">
            {saved.stockReturn.isReturn
              ? t("Now WhatsApp purchasing about the stock return.")
              : t("Now WhatsApp the office about the balance stock.")}
          </h3>
          <p className="text-sm">
            {t("Send a photo of the stock with this message.")}
          </p>
          <pre className="rounded-lg bg-background p-3 font-sans text-sm whitespace-pre-wrap text-foreground">
            {saved.stockReturn.text}
          </pre>
          <Button asChild className="h-12 text-base">
            <a href={saved.stockReturn.href} target="_blank" rel="noopener">
              <MessageCircle data-icon="inline-start" />
              {t("Send on WhatsApp")}
            </a>
          </Button>
        </section>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-12 text-base"
        onClick={onAnother}
      >
        <Plus data-icon="inline-start" />
        {t("Another site today")}
      </Button>
      <Button asChild variant="ghost" className="h-12 text-base">
        <Link href={doneHref}>{t("Done")}</Link>
      </Button>
    </div>
  );
}
