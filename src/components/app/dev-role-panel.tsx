"use client";

import { UserRound, X } from "lucide-react";
import { useState, useTransition } from "react";
import { devSignIn } from "@/app/dev/dev-sign-in-actions";
import { Button } from "@/components/ui/button";
import { JobRole, JobRoleLabel } from "@/lib/auth/job-role";

/**
 * Laptop only (`pnpm dev`): signs in as any job role's test person with one click. Bottom left above
 * the Next.js dev badge, collapsed by default, so it stays clear of the sign-in button and toasts.
 */
export function DevRolePanel({ currentRole }: { currentRole: JobRole | null }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = currentRole ? JobRoleLabel[currentRole] : "Signed out";

  function signInAs(jobRole: JobRole) {
    setError(null);
    startTransition(async () => {
      const result = await devSignIn(jobRole);
      setError(result.error);
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="fixed bottom-16 left-4 z-50 shadow-md"
        onClick={() => setOpen(true)}
      >
        <UserRound aria-hidden />
        {current}
      </Button>
    );
  }

  return (
    <section
      aria-label="Sign in as a job role"
      className="fixed bottom-16 left-4 z-50 w-[min(18rem,calc(100vw-2rem))] rounded-lg border bg-card p-3 text-card-foreground shadow-md"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm">
          <span className="text-muted-foreground">Now: </span>
          {current}
        </p>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Close"
          onClick={() => setOpen(false)}
        >
          <X aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {JobRole.options.map((jobRole) => (
          <Button
            key={jobRole}
            type="button"
            size="sm"
            variant={jobRole === currentRole ? "secondary" : "outline"}
            disabled={pending}
            onClick={() => signInAs(jobRole)}
          >
            {JobRoleLabel[jobRole]}
          </Button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}
