import Link from "next/link";
import { cn } from "@/lib/utils";

export type ClaimTab = { id: string; label: string; href: string };

/** A row of link tabs, for the manager's views and the claim months. */
export function ClaimTabs({
  tabs,
  active,
  label,
}: {
  tabs: readonly ClaimTab[];
  active: string;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          role="tab"
          aria-selected={tab.id === active}
          href={tab.href}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted/50",
            tab.id === active && "border-primary bg-muted",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
