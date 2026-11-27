import Link from "next/link";
import type { ReactNode } from "react";
import type { DataTableColumn } from "@/components/app/data-table";
import { cn } from "@/lib/utils";

export function mofNoColumn<Row extends { mofNo: string }>(
  getMofId: (row: Row) => string,
): DataTableColumn<Row> {
  return {
    key: "mofNo",
    header: "MOF no.",
    cell: (row) => (
      <Link
        href={`/mofs/${getMofId(row)}`}
        className="font-mono font-medium hover:underline"
      >
        {row.mofNo}
      </Link>
    ),
  };
}

/** `renderBelow` adds a page's own item, such as a status pill, under the project name. */
export function mofProjectColumn<
  Row extends { companyName: string; projectName: string },
>(renderBelow?: (row: Row) => ReactNode): DataTableColumn<Row> {
  return {
    key: "project",
    header: "Company / project",
    cell: (row) => (
      <div className={cn("flex flex-col", renderBelow && "items-start gap-1")}>
        <span className="font-medium">{row.companyName}</span>
        <span className="text-xs text-muted-foreground">{row.projectName}</span>
        {renderBelow?.(row)}
      </div>
    ),
  };
}
