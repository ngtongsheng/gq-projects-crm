import { FileText } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { formatPickupNo, PICKUP_METHOD_LABEL } from "@/lib/domain/samples";
import { formatDate, todayMyt } from "@/lib/format/date";
import { formatQuantity } from "@/lib/format/quantity";
import type { PickupFormRow } from "./samples-data";

/** The newest pickup forms, each opening its signature receipt for print or PDF. */
export function PickupFormsTable({
  forms,
  nameOf,
}: {
  forms: PickupFormRow[];
  nameOf: ReadonlyMap<string, string>;
}) {
  return (
    <DataTable
      rows={forms}
      getRowKey={(form) => form.id}
      empty={
        <EmptyState
          icon={FileText}
          title="No pickup forms yet"
          description="A form is numbered when it is saved."
        />
      }
      columns={[
        {
          key: "no",
          header: "Form",
          cell: (form) => (
            <span className="font-mono text-sm font-medium">
              {formatPickupNo(form.runningNo)}
            </span>
          ),
        },
        {
          key: "date",
          header: "Date",
          cell: (form) => (
            <span className="font-mono text-sm whitespace-nowrap tabular-nums">
              {formatDate(form.appointmentOn)}
            </span>
          ),
        },
        {
          key: "items",
          header: "Items",
          cell: (form) =>
            form.lines
              .map(
                (line) =>
                  `${formatQuantity(line.qty)} ${line.unit} ${line.productName}`,
              )
              .join(", "),
        },
        {
          key: "method",
          header: "Method",
          cell: (form) => PICKUP_METHOD_LABEL[form.method],
        },
        {
          key: "for",
          header: "For",
          cell: (form) => (
            <div className="flex flex-col">
              <span>{form.personInCharge}</span>
              {form.forWhom && (
                <span className="text-xs text-muted-foreground">
                  {form.forWhom}
                </span>
              )}
            </div>
          ),
        },
        {
          key: "by",
          header: "By",
          cell: (form) =>
            form.createdBy ? (nameOf.get(form.createdBy) ?? "") : "",
        },
        {
          key: "open",
          header: "",
          cell: (form) => (
            <div className="flex flex-col items-start gap-0.5">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/samples/pickup/${form.id}`}>Open / PDF</Link>
              </Button>
              {form.pdfSavedAt && (
                <span className="text-xs text-muted-foreground">
                  PDF {formatDate(todayMyt(new Date(form.pdfSavedAt)))}
                </span>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
