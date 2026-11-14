"use client";

import { Eye } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { viewAs } from "./impersonate-actions";

/** For the MD only: opens the app exactly as this person sees it, without saving anything. */
export function ViewAsButton({
  userId,
  name,
}: {
  userId: string;
  name: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function go() {
    startTransition(async () => {
      const result = await viewAs(userId);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={go}
      disabled={pending}
      title={`See exactly what ${name ?? "this person"} sees`}
      aria-label={`View as ${name ?? "this person"}`}
    >
      <Eye data-icon="inline-start" />
      {pending ? "Opening..." : "View as"}
    </Button>
  );
}
