"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copies the quote as tab-separated text so it pastes straight into Excel. */
export function CopyTsvButton({ tsv }: { tsv: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(tsv);
      toast.success("Copied. Paste it straight into Excel.");
    } catch {
      toast.error("The browser did not allow copying.");
    }
  }

  return (
    <Button type="button" variant="outline" onClick={copy}>
      <Copy aria-hidden />
      Copy for Excel
    </Button>
  );
}
