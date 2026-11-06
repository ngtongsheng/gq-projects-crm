"use client";

import { UserPlus } from "lucide-react";
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
import { JobRole, JobRoleLabel } from "@/lib/auth/job-role";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { type AddPersonState, addPerson } from "./actions";
import { InviteShare } from "./invite-share";

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
            You get a link to send them. Add their WhatsApp number to open
            WhatsApp with the message ready. They use the link once to set a
            password.
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
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();

  function create(formData: FormData) {
    startTransition(async () => {
      setState(await addPerson(formData));
    });
  }

  if (state.invite) {
    return (
      <div className="flex flex-col gap-3">
        {state.error && <FieldError>{state.error}</FieldError>}
        <InviteShare invite={state.invite} />
      </div>
    );
  }

  return (
    <form onSubmit={submitKeepingValues(create)}>
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
          <FieldLabel htmlFor="mobile">WhatsApp number (optional)</FieldLabel>
          <Input
            id="mobile"
            name="mobile"
            type="tel"
            inputMode="tel"
            placeholder="012-345 6789"
            autoComplete="off"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="jobRole">Job role</FieldLabel>
            <Select name="jobRole" defaultValue="sales">
              <SelectTrigger id="jobRole">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JobRole.options.map((jobRole) => (
                  <SelectItem key={jobRole} value={jobRole}>
                    {JobRoleLabel[jobRole]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="role">Admin or staff</FieldLabel>
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
        </div>
        {state.error && <FieldError>{state.error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Create link"}
        </Button>
      </FieldGroup>
    </form>
  );
}
