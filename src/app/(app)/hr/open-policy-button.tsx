"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/language-context";
import { openPolicyFile } from "./policy-actions";

/** Opens the policy PDF in a new tab; the tab is opened first so a phone browser does not block it. */
export function OpenPolicyButton({ id }: { id: string }) {
  const t = useT();
  async function open() {
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    const result = await openPolicyFile(id);
    if (result.error !== null) {
      tab?.close();
      toast.error(result.error);
      return;
    }
    if (tab) tab.location.href = result.url;
    else window.location.href = result.url;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void open()}
    >
      {t("Open PDF")}
    </Button>
  );
}
