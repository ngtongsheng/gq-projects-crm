import type { FormEvent } from "react";

/**
 * Submit handler for a form whose save runs in a server action. A `<form action>` clears every
 * field as soon as it is submitted, so a refused save (missing reason, amount too large) wiped
 * what the person had typed. This reads the values and leaves the form alone; the caller resets
 * it with the `form` argument when the save worked and the form stays on screen.
 */
export function submitKeepingValues(
  submit: (formData: FormData, form: HTMLFormElement) => void,
) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    submit(new FormData(form), form);
  };
}
