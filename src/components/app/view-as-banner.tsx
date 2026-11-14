import { Eye } from "lucide-react";
import { endViewAs } from "@/app/(app)/people/impersonate-actions";
import { Button } from "@/components/ui/button";

/** At the top of the page while the MD views as someone, so it is never a surprise. */
export function ViewAsBanner({
  name,
  title,
  backTo,
}: {
  name: string;
  title: string;
  /** The MD's name; null when the view has expired and only signing out is left. */
  backTo: string | null;
}) {
  return (
    <output className="sticky top-(--header-height) z-20 flex flex-wrap items-center gap-3 rounded-lg bg-view-as px-3.5 py-3 text-sm text-view-as-foreground">
      <span className="min-w-0 flex-1">
        <strong className="inline-flex items-center gap-1.5 align-middle">
          <Eye className="size-4" aria-hidden />
          Viewing as {name}
        </strong>{" "}
        · {title} — this is exactly what {name} sees. View only: nothing you
        click here is saved.
      </span>
      <form action={endViewAs}>
        <Button
          type="submit"
          size="sm"
          className="bg-view-as-foreground text-view-as hover:bg-view-as-foreground/90"
        >
          {backTo ? `Back to ${backTo}` : "Back to my account"}
        </Button>
      </form>
    </output>
  );
}
