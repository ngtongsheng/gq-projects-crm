"use client";

import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/app-name";
import { errorDigest } from "@/lib/error/error-digest";
import "./globals.css";

/**
 * Last resort when the root layout itself fails. It replaces that layout, so there is no language
 * provider here: the message is English only.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const digest = errorDigest(error);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col items-center justify-center bg-background text-foreground">
        <title>{APP_NAME}</title>
        <EmptyState
          icon={TriangleAlert}
          title="Something went wrong. Try again."
          description={digest ? `Reference: ${digest}` : undefined}
          action={<Button onClick={() => retry()}>Try again</Button>}
        />
      </body>
    </html>
  );
}
