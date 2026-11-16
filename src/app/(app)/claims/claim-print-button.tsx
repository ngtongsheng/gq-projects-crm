"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Prints the claim form below the page, not the screen. */
export function ClaimPrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer aria-hidden data-icon="inline-start" />
      {label}
    </Button>
  );
}
