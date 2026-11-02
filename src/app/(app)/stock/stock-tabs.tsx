import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "reservations", label: "Reservations", href: "/stock" },
  { key: "items", label: "Stock items", href: "/stock?view=items" },
  { key: "leftover", label: "Leftover stock", href: "/stock/leftover" },
] as const;

export type StockTab = (typeof TABS)[number]["key"];

/** Links between the Stock pages; the current one is marked. */
export function StockTabs({ active }: { active: StockTab }) {
  return (
    <nav aria-label="Stock" className="flex gap-1 border-b">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
            tab.key === active
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
