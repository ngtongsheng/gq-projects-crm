"use client";

import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { Invite } from "./invite-message";

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Could not copy. Select the text and copy it by hand.");
  }
}

/** The app link to send: straight into WhatsApp when the mobile is known, or copied. */
export function InviteShare({ invite }: { invite: Invite }) {
  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor="invite-message">
          Message to send on WhatsApp
        </FieldLabel>
        <Textarea
          id="invite-message"
          className="field-sizing-fixed w-full break-all"
          readOnly
          rows={5}
          value={invite.message}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        {invite.whatsappUrl && (
          <Button asChild>
            <a href={invite.whatsappUrl} target="_blank" rel="noreferrer">
              <MessageCircle data-icon="inline-start" />
              Open WhatsApp
            </a>
          </Button>
        )}
        <Button
          type="button"
          variant={invite.whatsappUrl ? "outline" : "default"}
          onClick={() => copy(invite.message, "Message copied.")}
        >
          <Copy data-icon="inline-start" />
          Copy message
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => copy(invite.link, "Link copied.")}
        >
          Copy link only
        </Button>
      </div>
    </div>
  );
}
