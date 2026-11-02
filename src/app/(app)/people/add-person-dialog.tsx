"use client";

import { Copy, UserPlus } from "lucide-react";
import { useActionState } from "react";
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type AddPersonState, addPerson } from "./actions";

const initialState: AddPersonState = { error: null, invite: null };

/** Radix unmounts the content on close, so each opening starts a fresh form. */
export function AddPersonDialog({
  unavailableMessage,
}: {
  unavailableMessage: string | null;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <UserPlus data-icon="inline-start" />
          Add person
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add person</DialogTitle>
          <DialogDescription>
            You get a link to send them. They use it once to set a password.
          </DialogDescription>
        </DialogHeader>
        {unavailableMessage ? (
          <p className="text-sm">{unavailableMessage}</p>
        ) : (
          <AddPersonForm />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddPersonForm() {
  const [state, formAction, pending] = useActionState(addPerson, initialState);

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  }

  if (state.invite) {
    return (
      <div className="flex flex-col gap-3">
        {state.error && <FieldError>{state.error}</FieldError>}
        <Field>
          <FieldLabel htmlFor="invite-message">
            Message to send on WhatsApp
          </FieldLabel>
          <Textarea
            id="invite-message"
            className="field-sizing-fixed w-full break-all"
            readOnly
            rows={5}
            value={state.invite.message}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => copy(state.invite?.message ?? "", "Message copied.")}
          >
            <Copy data-icon="inline-start" />
            Copy message
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => copy(state.invite?.link ?? "", "Link copied.")}
          >
            Copy link only
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="fullName">Name</FieldLabel>
          <Input id="fullName" name="fullName" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="role">Role</FieldLabel>
          <Select name="role" defaultValue="staff">
            <SelectTrigger id="role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {state.error && <FieldError>{state.error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Create link"}
        </Button>
      </FieldGroup>
    </form>
  );
}
