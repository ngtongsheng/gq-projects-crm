"use client";

import { UserRound, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  type DevPerson,
  devSignIn,
  listDevPeople,
} from "@/app/dev/dev-sign-in-actions";
import { Button } from "@/components/ui/button";
import { type JobRole, JobRoleLabel } from "@/lib/auth/job-role";

/**
 * Laptop only (`pnpm dev`): signs in as any active test person ("Name — title") with one click. Bottom left above
 * the Next.js dev badge, collapsed by default, so it stays clear of the sign-in button and toasts.
 */
export function DevRolePanel({
  currentId,
  currentRole,
}: {
  currentId: string | null;
  currentRole: JobRole | null;
}) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<DevPerson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = currentRole ? JobRoleLabel[currentRole] : "Signed out";

  useEffect(() => {
    if (open) void listDevPeople().then(setPeople);
  }, [open]);

  function signInAs(personId: string) {
    setError(null);
    startTransition(async () => {
      const result = await devSignIn(personId);
      setError(result.error);
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="fixed bottom-16 left-4 z-50 shadow-md print:hidden"
        onClick={() => setOpen(true)}
      >
        <UserRound aria-hidden />
        {current}
      </Button>
    );
  }

  return (
    <section
      aria-label="Sign in as a person"
      className="fixed bottom-16 left-4 z-50 w-[min(20rem,calc(100vw-2rem))] print:hidden rounded-lg border bg-card p-3 text-card-foreground shadow-md"
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
      <div className="grid max-h-80 gap-1.5 overflow-y-auto">
        {people.map((person) => (
          <Button
            key={person.id}
            type="button"
            size="sm"
            variant={person.id === currentId ? "secondary" : "outline"}
            className="justify-start"
            disabled={pending}
            onClick={() => signInAs(person.id)}
          >
            {person.title
              ? `${person.fullName} — ${person.title}`
              : person.fullName}
          </Button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}
