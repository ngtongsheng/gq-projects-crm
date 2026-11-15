"use client";

import { Paperclip } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { FileUpload } from "@/components/app/file-upload";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { uploadLeaveSlip } from "./leave-upload";
import { confirmOriginalSlip, openLeaveSlip } from "./slip-actions";

/** Opens the slip in a new tab; the tab is opened first so a phone browser does not block it. */
export function ViewSlipButton({ leaveId }: { leaveId: string }) {
  async function open() {
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    const result = await openLeaveSlip(leaveId);
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
      View MC
    </Button>
  );
}

/** Adds the MC or hospitalisation slip later, from the leave list. */
export function UploadSlipButton({ leaveId }: { leaveId: string }) {
  return (
    <FileUpload
      label="MC"
      upload={async (picked) => {
        const sent = await uploadLeaveSlip(leaveId, picked);
        if (sent.ok) toast.success("MC uploaded.");
        return sent;
      }}
    />
  );
}

/** HR & Accounts ticks that the original slip was handed in. */
export function OriginalSlipCheck({
  leaveId,
  given,
}: {
  leaveId: string;
  given: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 text-xs">
      <Checkbox
        id={`original-${leaveId}`}
        checked={given}
        disabled={pending}
        onCheckedChange={(checked) =>
          startTransition(async () => {
            const result = await confirmOriginalSlip(leaveId, checked === true);
            if (result.error !== null) toast.error(result.error);
          })
        }
      />
      <Label htmlFor={`original-${leaveId}`} className="font-normal">
        Original given to HR
      </Label>
    </div>
  );
}
