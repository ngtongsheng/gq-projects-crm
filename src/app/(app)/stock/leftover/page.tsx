import { Boxes } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { DownloadCsvButton } from "@/components/app/download-csv-button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { canEditStock } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  creditNoteState,
  LEFTOVER_CONDITION_LABEL,
  LEFTOVER_DESTINATION_LABEL,
  LEFTOVER_UNIT_LABEL,
} from "@/lib/domain/leftover";
import { formatDateTime } from "@/lib/format/date";
import { StockTabs } from "../stock-tabs";
import { LeftoverBadges } from "./leftover-badges";
import { loadLeftovers } from "./leftover-data";
import { UpdateLeftoverDialog } from "./update-leftover-dialog";

export const metadata: Metadata = { title: "Leftover stock" };

export default async function LeftoverPage() {
  const me = await requireSection("stock");
  const [leftovers, team] = await Promise.all([
    loadLeftovers(),
    getTeamDirectory(),
  ]);
  const canEdit = canEditStock(me);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  const waitingForPickup = leftovers.filter(
    (leftover) => leftover.status === "pending_pickup",
  ).length;
  const waitingForCreditNote = leftovers.filter(
    (leftover) => creditNoteState(leftover)?.kind === "pending",
  ).length;
  const summary = [
    waitingForPickup > 0 && `${waitingForPickup} waiting for pickup`,
    waitingForCreditNote > 0 &&
      `${waitingForCreditNote} waiting for a supplier credit note`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leftover stock"
        description={
          summary.length > 0
            ? summary.join(" · ")
            : "Stock left over at sites, from pickup to the supplier's credit note."
        }
        actions={<DownloadCsvButton path="/stock/leftover/export" />}
      />
      <StockTabs active="leftover" />
      <DataTable
        rows={leftovers}
        getRowKey={(leftover) => leftover.id}
        empty={
          <EmptyState
            icon={Boxes}
            title="No leftover stock yet"
            description="A site supervisor records it from the site's page under Site Work."
          />
        }
        columns={[
          {
            key: "item",
            header: "Item",
            cell: (leftover) => (
              <div className="flex min-w-48 flex-col">
                <span className="font-medium">{leftover.item}</span>
                <span className="text-xs text-muted-foreground">
                  {LEFTOVER_CONDITION_LABEL[leftover.condition]} ·{" "}
                  {LEFTOVER_DESTINATION_LABEL[leftover.destination]}
                </span>
                {leftover.note && (
                  <span className="text-xs text-muted-foreground">
                    {leftover.note}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "site",
            header: "From job",
            cell: (leftover) => (
              <Link
                href={`/site-work/${leftover.mofId}`}
                className="flex flex-col hover:underline"
              >
                <span className="font-mono text-sm">{leftover.mofNo}</span>
                <span className="text-xs text-muted-foreground">
                  {leftover.projectName}
                </span>
              </Link>
            ),
          },
          {
            key: "qty",
            header: "Qty",
            numeric: true,
            cell: (leftover) =>
              `${leftover.qty.toLocaleString("en-MY")} ${LEFTOVER_UNIT_LABEL[leftover.unit]}`,
          },
          {
            key: "status",
            header: "Status",
            cell: (leftover) => <LeftoverBadges leftover={leftover} />,
          },
          {
            key: "recorded",
            header: "Recorded",
            cell: (leftover) => (
              <div className="flex flex-col">
                <span className="font-mono text-sm tabular-nums">
                  {formatDateTime(leftover.recordedOn)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {leftover.recordedBy
                    ? (nameOf.get(leftover.recordedBy) ?? "Unnamed")
                    : ""}
                </span>
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            cell: (leftover) =>
              canEdit ? <UpdateLeftoverDialog leftover={leftover} /> : null,
          },
        ]}
      />
    </div>
  );
}
