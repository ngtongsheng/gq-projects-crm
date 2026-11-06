"use client";

import { LogIn } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signInAs } from "./impersonate-actions";

/** For the MD only: opens the CRM exactly as this person sees it. */
export function SignInAsButton({
  userId,
  name,
}: {
  userId: string;
  name: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function go() {
    startTransition(async () => {
      const result = await signInAs(userId);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={go}
      disabled={pending}
      aria-label={`Sign in as ${name ?? "this person"}`}
    >
      <LogIn data-icon="inline-start" />
      {pending ? "Switching..." : "Sign in as"}
    </Button>
  );
}
