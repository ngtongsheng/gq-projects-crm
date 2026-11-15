"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/language-context";
import { removeFormLink } from "./form-link-actions";

export function RemoveFormLinkButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const t = useT();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await removeFormLink(id);
          if (result.error) toast.error(result.error);
        })
      }
    >
      {t("Remove")}
    </Button>
  );
}
