"use client";

import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { errorDigest } from "@/lib/error/error-digest";
import { useT } from "@/lib/i18n/language-context";

/** Shown inside the app shell when a page fails; the menu stays so the person can go elsewhere. */
export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const t = useT();
  const digest = errorDigest(error);

  return (
    <EmptyState
      icon={TriangleAlert}
      title={t("Something went wrong. Try again.")}
      description={digest ? `${t("Reference")}: ${digest}` : undefined}
      action={<Button onClick={() => retry()}>{t("Try again")}</Button>}
    />
  );
}
