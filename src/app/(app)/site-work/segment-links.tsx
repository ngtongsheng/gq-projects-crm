import Link from "next/link";
import { cn } from "@/lib/utils";

export type SegmentItem = { key: string; label: string; href: string };

/** The demo's segment control: each choice is its own address, so it survives a reload. */
export function SegmentLinks({
  items,
  active,
  label,
}: {
  items: readonly SegmentItem[];
  active: string;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          role="tab"
          aria-selected={item.key === active}
          href={item.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
            item.key === active
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
