import { FileText, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { DownloadCsvButton } from "@/components/app/download-csv-button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PasteImportDialog } from "@/components/app/paste-import-dialog";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canEditRegister, isManager } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { isFinalStage, MOF_STAGE_TONE } from "@/lib/domain/mof-stages";
import { formatDate } from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import { importMofs, previewMofImport } from "./import-actions";
import { loadRegister } from "./mof-data";
import { parseMofFilters, seesOnlyOwnMofs, visibleMofs } from "./mof-filters";
import { mofImportFields } from "./mof-import";
import { MofStage, MofStageLabel } from "./schemas";
import { StageSelect } from "./stage-select";

export const metadata: Metadata = { title: "MOF Register" };

const ALL = "all";

export default async function MofRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireSection("mof");
  const filters = parseMofFilters(await searchParams);
  const ownOnly = seesOnlyOwnMofs(me.jobRole);
  const canEdit = canEditRegister(me.jobRole);
  const [all, team] = await Promise.all([loadRegister(), getTeamDirectory()]);
  const rows = visibleMofs(all, me, filters);
  const filtered = filters.stage !== undefined || filters.person !== undefined;
  const live = rows.filter((row) => row.stage !== "cancelled");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={ownOnly ? "My Sales" : "MOF Register"}
        description={
          ownOnly
            ? "Every MOF registered under your name. This is your sales achievement."
            : "One line per MOF. Cancelled orders are left out of the total."
        }
        actions={
          <>
            <DownloadCsvButton
              path="/mofs/export"
              query={{ stage: filters.stage, person: filters.person }}
            />
            {canEdit && (
              <PasteImportDialog
                title="Paste MOFs from sheet"
                description="One row per product. An MOF with several products repeats its MOF no. on each row. An MOF already in the register is changed only in the columns you paste; a changed contract sum or VO is logged as Imported."
                kinds={[
                  {
                    value: "mofs",
                    label: "MOFs",
                    columns: mofImportFields(isManager(me.jobRole)).map(
                      (field) => field.label,
                    ),
                  },
                ]}
                preview={previewMofImport}
                save={importMofs}
              />
            )}
            {canEdit && (
              <Button asChild>
                <Link href="/mofs/new">
                  <Plus data-icon="inline-start" />
                  Register new MOF
                </Link>
              </Button>
            )}
          </>
        }
      />
      <form action="/mofs" className="flex flex-wrap items-center gap-2">
        <Select name="stage" defaultValue={filters.stage ?? ALL}>
          <SelectTrigger aria-label="Stage" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stages</SelectItem>
            {MofStage.options.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {MofStageLabel[stage]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!ownOnly && (
          <Select name="person" defaultValue={filters.person ?? ALL}>
            <SelectTrigger aria-label="Person" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Everyone</SelectItem>
              {team.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button type="submit" variant="outline">
          <Search data-icon="inline-start" />
          Filter
        </Button>
        <span className="ml-auto font-mono text-sm tabular-nums text-muted-foreground">
          {rows.length} MOFs · {formatRm(sumRm(live.map((row) => row.total)))}
        </span>
      </form>
      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={FileText}
            title={filtered ? "No MOFs match" : "No MOFs yet"}
            description={
              filtered
                ? "Try a different stage or person, or show everything."
                : canEdit
                  ? "Register a new MOF once the PO or LOA comes in."
                  : "MOFs appear here once they are registered."
            }
          />
        }
        columns={[
          {
            key: "mofNo",
            header: "MOF no.",
            cell: (row) => (
              <Link
                href={`/mofs/${row.id}`}
                className="font-mono font-medium hover:underline"
              >
                {row.mofNo}
              </Link>
            ),
          },
          {
            key: "loaDate",
            header: "LOA date",
            numeric: true,
            cell: (row) => formatDate(row.loaDate),
          },
          { key: "people", header: "Salesperson", cell: (row) => row.people },
          {
            key: "project",
            header: "Company / project",
            cell: (row) => (
              <div className="flex flex-col">
                <span className="font-medium">{row.companyName}</span>
                <span className="text-xs text-muted-foreground">
                  {row.projectName}
                </span>
              </div>
            ),
          },
          {
            key: "total",
            header: "Order total",
            numeric: true,
            cell: (row) => formatRm(row.total),
          },
          {
            key: "delivery",
            header: "Delivery",
            numeric: true,
            cell: (row) =>
              row.deliveryDate ? formatDate(row.deliveryDate) : "–",
          },
          {
            key: "stage",
            header: "Stage",
            cell: (row) => (
              <div className="flex flex-col gap-1">
                {canEdit && !isFinalStage(row.stage) ? (
                  <StageSelect mofId={row.id} stage={row.stage} />
                ) : (
                  <span>
                    <StatusBadge tone={MOF_STAGE_TONE[row.stage]}>
                      {MofStageLabel[row.stage]}
                    </StatusBadge>
                  </span>
                )}
                {row.missingSupplierPo && (
                  <span>
                    <StatusBadge tone="warn">No supplier PO</StatusBadge>
                  </span>
                )}
                {row.ticks < 4 && !isFinalStage(row.stage) && (
                  <span>
                    <StatusBadge tone="warn">{row.ticks}/4 checks</StatusBadge>
                  </span>
                )}
                {row.latestUpdate && (
                  <span className="text-xs text-muted-foreground">
                    {row.latestUpdate}
                  </span>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
