import { Eye } from "lucide-react";
import { backToMyAccount } from "@/app/(app)/people/impersonate-actions";
import { Button } from "@/components/ui/button";

/** Across the top while the MD is signed in as someone else, so it is never a surprise. */
export function ImpersonationBar({ name }: { name: string | null }) {
  return (
    <output className="flex flex-wrap items-center gap-3 bg-warn-bg px-4 py-2 text-sm text-warn">
      <Eye className="size-4" aria-hidden />
      <span className="mr-auto">
        You are signed in as <strong>{name ?? "this person"}</strong>. What you
        do is saved under their name.
      </span>
      <form action={backToMyAccount}>
        <Button type="submit" size="sm" variant="outline">
          Back to my account
        </Button>
      </form>
    </output>
  );
}
