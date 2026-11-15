"use client";

import { X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeHoliday } from "./holiday-actions";

/** One holiday with its remove button; the button only shows for people who may edit. */
export function HolidayPill({
  day,
  label,
  canRemove,
}: {
  day: string;
  label: string;
  canRemove: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3 text-sm">
      {label}
      {canRemove ? (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          disabled={pending}
          aria-label={`Remove ${label}`}
          onClick={() =>
            startTransition(async () => {
              const result = await removeHoliday(day);
              if (result.error) toast.error(result.error);
            })
          }
        >
          <X />
        </Button>
      ) : (
        <span className="pr-2" />
      )}
    </li>
  );
}
