"use client";

import { KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { type AddPersonState, newSignInLink } from "./actions";
import { InviteShare } from "./invite-share";

/** Makes a fresh link for someone who lost theirs or forgot their password. */
export function NewLinkDialog({
  userId,
  name,
  unavailableMessage,
}: {
  userId: string;
  name: string | null;
  unavailableMessage: string | null;
}) {
  const [state, setState] = useState<AddPersonState | null>(null);
  const [pending, startTransition] = useTransition();

  function make() {
    startTransition(async () => {
      setState(await newSignInLink(userId));
    });
  }

  return (
    <Dialog onOpenChange={(open) => !open && setState(null)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <KeyRound data-icon="inline-start" />
          New link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New link for {name ?? "this person"}</DialogTitle>
          <DialogDescription>
            This makes a new link to set a password. Their old link stops
            working.
          </DialogDescription>
        </DialogHeader>
        {unavailableMessage ? (
          <p className="text-sm">{unavailableMessage}</p>
        ) : state?.invite ? (
          <InviteShare invite={state.invite} />
        ) : (
          <div className="flex flex-col gap-3">
            {state?.error && <FieldError>{state.error}</FieldError>}
            <Button type="button" onClick={make} disabled={pending}>
              {pending ? "Making..." : "Make a new link"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
