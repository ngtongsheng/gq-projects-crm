"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type SetPasswordState, setPassword } from "./actions";

const initialState: SetPasswordState = { error: null };

type SetPasswordFormProps = { tokenHash: string; type: string };

export function SetPasswordForm({ tokenHash, type }: SetPasswordFormProps) {
  const [state, formAction, pending] = useActionState(
    setPassword,
    initialState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmPassword">Type it again</FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        {state.error && <FieldError>{state.error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Set password"}
        </Button>
      </FieldGroup>
    </form>
  );
}
