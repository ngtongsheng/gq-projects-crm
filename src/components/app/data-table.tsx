import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumn<Row> = {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Right-aligned, monospace, tabular figures. For money, quantities, dates. */
  numeric?: boolean;
  /** Extra classes for the header and every cell, e.g. "max-sm:hidden" to drop a column on phones. */
  className?: string;
};

type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  /** Shown instead of the table when there are no rows, usually an EmptyState. */
  empty?: ReactNode;
};

export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  empty,
}: DataTableProps<Row>) {
  if (rows.length === 0 && empty) {
    return <div className="rounded-xl border bg-card">{empty}</div>;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader className="bg-sunk">
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  "h-9 px-3.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase",
                  column.numeric && "text-right",
                  column.className,
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={getRowKey(row)} className="hover:bg-sunk">
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    "px-3.5 py-2.5",
                    column.numeric &&
                      "text-right font-mono whitespace-nowrap tabular-nums",
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
