"use client";

import { Paperclip, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { FileUpload } from "@/components/app/file-upload";
import { Button } from "@/components/ui/button";
import { needsReceipt } from "@/lib/domain/claim-expense";
import { useT } from "@/lib/i18n/language-context";
import { deleteExpense } from "./expense-actions";
import {
  type EditableExpense,
  ExpenseDialog,
  type ExpenseRules,
} from "./expense-dialog";
import { openReceipt } from "./receipt-actions";
import { uploadReceipt } from "./receipt-upload";

/** Opens the receipt photo in a new tab; the tab is opened first so a phone browser does not block it. */
export function ViewReceiptButton({ expenseId }: { expenseId: string }) {
  const t = useT();
  async function open() {
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    const result = await openReceipt(expenseId);
    if (result.error !== null) {
      tab?.close();
      toast.error(result.error);
      return;
    }
    if (tab) tab.location.href = result.url;
    else window.location.href = result.url;
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => void open()}>
      <Paperclip data-icon="inline-start" />
      {t("View")}
    </Button>
  );
}

/** Edit, delete and attach a receipt: only while the claim is still the person's to change. */
export function ExpenseRowActions({
  expense,
  rules,
}: {
  expense: EditableExpense;
  rules: ExpenseRules;
}) {
  const [pending, startTransition] = useTransition();
  const t = useT();

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <ExpenseDialog rules={rules} expense={expense} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteExpense(expense.id);
              if (result.error !== null) toast.error(result.error);
            })
          }
        >
          <Trash2 data-icon="inline-start" />
          {t("Delete")}
        </Button>
      </div>
      {needsReceipt(expense.expenseType) && (
        <FileUpload
          label={t("receipt")}
          imagesOnly
          upload={async (picked) => {
            const sent = await uploadReceipt(expense.id, picked);
            if (sent.ok) toast.success(t("Receipt uploaded."));
            return sent;
          }}
        />
      )}
    </div>
  );
}
