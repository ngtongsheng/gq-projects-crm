import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { MOF_STAGE_LABEL, MOF_STAGE_TONE } from "@/lib/domain/mof-stages";
import type { PersonMofLine } from "@/lib/domain/sales-performance";
import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";

const percent = (value: number | null) =>
  value === null ? "–" : `${Math.round(value)}%`;

/** The MOFs behind one person's row: registered in the year, with margin only when the viewer may see cost. */
export function PersonMofs({
  name,
  year,
  lines,
  seesCost,
  closeHref,
}: {
  name: string;
  year: number;
  lines: readonly PersonMofLine[];
  seesCost: boolean;
  closeHref: string;
}) {
  return (
    <section id="person-mofs" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-heading text-base font-semibold">
          {name}&apos;s MOFs · {year}
        </h2>
        <span className="text-xs text-muted-foreground">
          {lines.length} {lines.length === 1 ? "MOF" : "MOFs"}
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link href={closeHref}>Close</Link>
        </Button>
      </div>
      <DataTable
        rows={[...lines]}
        getRowKey={(line) => line.mofId}
        empty={
          <p className="p-4 text-sm">
            No MOFs for {name} in {year}.
          </p>
        }
        columns={[
          {
            key: "mof",
            header: "MOF",
            cell: (line) => (
              <Link
                href={`/mofs/${line.mofId}`}
                className="font-mono font-medium underline-offset-2 hover:underline"
              >
                {line.mofNo}
              </Link>
            ),
          },
          {
            key: "project",
            header: "Project · customer",
            cell: (line) => (
              <>
                <span className="font-medium">{line.projectName}</span>
                <span className="block text-xs text-muted-foreground">
                  {line.companyName}
                </span>
              </>
            ),
          },
          {
            key: "loa",
            header: "LOA",
            numeric: true,
            cell: (line) => formatDate(line.loaDate),
          },
          {
            key: "sales",
            header: "Sales (RM)",
            numeric: true,
            cell: (line) => formatRm(line.sales),
          },
          ...(seesCost
            ? [
                {
                  key: "marginPct",
                  header: "Margin %",
                  numeric: true,
                  cell: (line: PersonMofLine) =>
                    line.marginPct === null
                      ? "no cost"
                      : percent(line.marginPct),
                },
                {
                  key: "marginRm",
                  header: "Margin (RM)",
                  numeric: true,
                  cell: (line: PersonMofLine) =>
                    line.marginRm === null ? "–" : formatRm(line.marginRm),
                },
              ]
            : []),
          {
            key: "collected",
            header: "Collected",
            numeric: true,
            cell: (line) => percent(line.collectedPct),
          },
          {
            key: "outstanding",
            header: "Outstanding (RM)",
            numeric: true,
            cell: (line) =>
              line.outstanding === 0 ? "–" : formatRm(line.outstanding),
          },
          {
            key: "status",
            header: "Status",
            cell: (line) => (
              <StatusBadge tone={MOF_STAGE_TONE[line.stage]}>
                {MOF_STAGE_LABEL[line.stage]}
              </StatusBadge>
            ),
          },
        ]}
      />
    </section>
  );
}
