"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/language-context";

/**
 * Back and Next (or Save). Fixed to the bottom of the screen on a phone so it is always under
 * the thumb; the message sits in the bar so it is seen however far down they have scrolled.
 */
export function WizardNav({
  error,
  pending,
  nextLabel,
  onNext,
  onBack,
  cancelHref,
}: {
  error: string | null;
  pending: boolean;
  nextLabel: string;
  onNext: () => void;
  onBack: (() => void) | null;
  /** Shown as Cancel on the first step, where there is nothing to go back to. */
  cancelHref: string;
}) {
  const t = useT();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t bg-background p-3 md:static md:border-0 md:p-0">
      {error && (
        <p role="alert" className="text-sm font-medium text-bad">
          {error}
        </p>
      )}
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        {onBack ? (
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            onClick={onBack}
          >
            {t("Back")}
          </Button>
        ) : (
          <Button asChild variant="outline" className="h-12 text-base">
            <Link href={cancelHref}>{t("Cancel")}</Link>
          </Button>
        )}
        <Button
          type="button"
          className="h-12 text-base"
          disabled={pending}
          onClick={onNext}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
