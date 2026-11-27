"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";

type DeleteConfirmProps = {
  /** A save or delete is running. */
  pending: boolean;
  /** Show the delete side; false while adding, or when the dialog never offers it for this record. */
  showDelete: boolean;
  /** Other records use this one, so say that in place of Delete. */
  inUse?: boolean;
  /** Already translated; shown beside "Yes, delete". */
  question: string;
  asking: boolean;
  onAskingChange: (asking: boolean) => void;
  onDelete: () => void;
  /** The question follows Save instead of sitting at the far end. */
  questionBesideSave?: boolean;
  /** Extra actions between Save and Delete. */
  children?: ReactNode;
};

/** The foot of an edit dialog's form: Save, then Delete, which asks before it deletes. */
export function DeleteConfirm({
  pending,
  showDelete,
  inUse = false,
  question,
  asking,
  onAskingChange,
  onDelete,
  questionBesideSave = false,
  children,
}: DeleteConfirmProps) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" disabled={pending}>
        {pending ? t("Saving...") : t("Save")}
      </Button>
      {children}
      {showDelete &&
        (inUse ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {t("In use, so it can't be deleted.")}
          </span>
        ) : asking ? (
          <span
            className={cn(
              "flex flex-wrap items-center gap-2 text-sm",
              !questionBesideSave && "ml-auto",
            )}
          >
            {question}
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={onDelete}
              disabled={pending}
            >
              {t("Yes, delete")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onAskingChange(false)}
            >
              {t("Keep")}
            </Button>
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="ml-auto text-bad"
            onClick={() => onAskingChange(true)}
          >
            {t("Delete")}
          </Button>
        ))}
    </div>
  );
}
