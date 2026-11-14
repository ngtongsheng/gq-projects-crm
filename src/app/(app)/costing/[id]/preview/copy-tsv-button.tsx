"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/language-context";

/** Copies the quote as tab-separated text so it pastes straight into Excel. */
export function CopyTsvButton({ tsv }: { tsv: string }) {
  const t = useT();

  async function copy() {
    try {
      await navigator.clipboard.writeText(tsv);
      toast.success(t("Copied. Paste it straight into Excel."));
    } catch {
      toast.error(t("The browser did not allow copying."));
    }
  }

  return (
    <Button type="button" variant="outline" onClick={copy}>
      <Copy aria-hidden />
      {t("Copy for Excel")}
    </Button>
  );
}
