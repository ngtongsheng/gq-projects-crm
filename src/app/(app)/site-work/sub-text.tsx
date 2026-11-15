import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A smaller grey line under a table cell's main text. */
export function SubText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("block text-xs text-muted-foreground", className)}>
      {children}
    </span>
  );
}
