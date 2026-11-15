"use client";

import { Mail } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { SupplierEmail } from "@/lib/domain/supplier-notice";
import { markSupplierNoticesSent } from "./supplier-notice-actions";

/** One draft per supplier to open in the email app, then mark as sent. Nothing is sent from here. */
export function SupplierEmailDialog({
  emails,
  pendingCount,
  trigger,
}: {
  emails: SupplierEmail[];
  pendingCount: number;
  trigger: "button" | "link";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function markSent(email: SupplierEmail) {
    startTransition(async () => {
      const result = await markSupplierNoticesSent(email.lines);
      if (result.error) toast.error(result.error);
      else toast.success(`Marked ${email.supplier} as told.`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "button" ? (
          <Button size="sm" variant="outline">
            <Mail data-icon="inline-start" />
            Email suppliers ({pendingCount})
          </Button>
        ) : (
          <Button size="sm" variant="link" className="h-auto justify-start p-0">
            Send now
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Email suppliers</DialogTitle>
          <DialogDescription>
            One email per supplier with every line to reserve, extend or
            release. Open it in your email app, send it, then tap Mark as sent.
          </DialogDescription>
        </DialogHeader>
        {emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing to send. Every supplier has been told.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {emails.map((email) => (
              <li
                key={email.supplier}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <b className="flex-1">{email.supplier}</b>
                  <span className="text-xs text-muted-foreground">
                    {email.lines.length}{" "}
                    {email.lines.length === 1 ? "line" : "lines"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Subject: {email.subject}
                  <br />
                  Add the supplier's address in your email app.
                </p>
                <Textarea
                  readOnly
                  rows={Math.min(12, email.body.split("\n").length + 1)}
                  value={email.body}
                  className="text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={email.mailto}>Open in email app</a>
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => markSent(email)}
                  >
                    Mark as sent
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" onClick={() => setOpen(false)}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
