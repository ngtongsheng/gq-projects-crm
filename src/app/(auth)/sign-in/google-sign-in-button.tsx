"use client";

import { LogIn } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <LogIn data-icon="inline-start" />
      {pending ? "Opening Google..." : "Sign in with Google"}
    </Button>
  );
}
