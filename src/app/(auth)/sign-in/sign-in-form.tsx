"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { type SignInState, signIn } from "./actions";

const initialState: SignInState = { error: null };

export function SignInForm() {
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData, form: HTMLFormElement) {
    startTransition(async () => {
      const result = await signIn(formData);
      setState(result);
      // The email stays; the password is typed again.
      if (result.error) {
        const password = form.elements.namedItem("password");
        if (password instanceof HTMLInputElement) password.value = "";
      }
    });
  }

  return (
    <form onSubmit={submitKeepingValues(submit)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        {state.error && <FieldError>{state.error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </FieldGroup>
    </form>
  );
}
