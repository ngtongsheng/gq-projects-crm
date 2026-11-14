import { ArrowLeft, FileText, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/app/data-table";
import { DownloadCsvButton } from "@/components/app/download-csv-button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { seesMofCost } from "@/lib/auth/page-access";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { MOF_STAGE_TONE } from "@/lib/domain/mof-stages";
import { formatDate, todayMyt } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { filterMofs, parseMofFilters } from "../mof-filters";
import { JobScopeLabel, MofStage, MofStageLabel } from "../schemas";
import {
  inYear,
  loadSummary,
  parseSummaryYear,
  summaryTotals,
  summaryYears,
} from "./summary-data";

export const metadata: Metadata = { title: "MOF Summary" };

const ALL = "all";

const percent = (value: number | null) =>
  value === null ? "–" : `${value.toFixed(1)}%`;

export default async function MofSummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("mof");
  if (!(await seesMofCost(me))) redirect("/not-allowed");

  const params = await searchParams;
  const filters = parseMofFilters(params);
  const [all, team] = await Promise.all([loadSummary(), getTeamDirectory()]);
  const thisYear = Number(todayMyt().slice(0, 4));
  const years = summaryYears(all, thisYear);
  const year = parseSummaryYear(params.year, years, thisYear);
  const rows = filterMofs(inYear(all, year), filters);
  const totals = summaryTotals(rows);
  const filtered = filters.stage !== undefined || filters.person !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/mofs"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        MOF Register
      </Link>
      <PageHeader
        title="MOF Summary"
        description="One line per MOF: what was invoiced, what has come in, what it cost and what is left. Cancelled orders are left out of the totals."
        actions={
          <DownloadCsvButton
            path="/mofs/summary/export"
            query={{
              stage: filters.stage,
              person: filters.person,
              year: year === null ? "all" : String(year),
            }}
          />
        }
      />
      <form
        action="/mofs/summary"
        className="flex flex-wrap items-center gap-2"
      >
        <Select name="year" defaultValue={year === null ? ALL : String(year)}>
          <SelectTrigger aria-label="Year" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
            <SelectItem value={ALL}>All years</SelectItem>
          </SelectContent>
        </Select>
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
        <Button type="submit" variant="outline">
          <Search data-icon="inline-start" />
          Filter
        </Button>
        {filtered && (
          <Button asChild variant="ghost">
            <Link href="/mofs/summary">Clear</Link>
          </Button>
        )}
      </form>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Figure label="MOFs" value={String(totals.count)} />
        <Figure label="Invoiced" value={formatRm(totals.invoice)} />
        <Figure label="Received" value={formatRm(totals.received)} />
        <Figure label="Balance" value={formatRm(totals.balance)} />
        <Figure label="Cost" value={formatRm(totals.cost)} />
        <Figure
          label="Margin"
          value={`${formatRm(totals.margin)} · ${percent(totals.marginPct)}`}
        />
      </dl>
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
          { key: "people", header: "Salesperson", cell: (row) => row.people },
          {
            key: "contacts",
            header: "Customer / accounts contact",
            cell: (row) => (
              <div className="flex flex-col text-xs">
                <span>{row.customerContact || "–"}</span>
                <span className="text-muted-foreground">
                  {row.accountsContact || "–"}
                </span>
              </div>
            ),
          },
          {
            key: "scope",
            header: "Job scope",
            cell: (row) => JobScopeLabel[row.scope],
          },
          {
            key: "products",
            header: "Product",
            cell: (row) => row.products || "–",
          },
          {
            key: "installer",
            header: "Installer",
            cell: (row) => row.installer || "–",
          },
          {
            key: "invoice",
            header: "Invoice (RM)",
            numeric: true,
            cell: (row) => formatRm(row.invoice),
          },
          {
            key: "received",
            header: "Received (RM)",
            numeric: true,
            cell: (row) => formatRm(row.received),
          },
          {
            key: "balance",
            header: "Balance (RM)",
            numeric: true,
            cell: (row) => formatRm(row.balance),
          },
          {
            key: "receivedPct",
            header: "Received %",
            numeric: true,
            cell: (row) => percent(row.receivedPct),
          },
          {
            key: "retention",
            header: "Retention",
            numeric: true,
            cell: (row) => (row.retentionPct ? `${row.retentionPct}%` : "–"),
          },
          {
            key: "invoiceNo",
            header: "Invoice no. / date",
            cell: (row) => (
              <div className="flex flex-col">
                <span className="font-mono">{row.invoiceNo || "–"}</span>
                <span className="text-xs text-muted-foreground">
                  {row.invoiceDate ? formatDate(row.invoiceDate) : "–"}
                </span>
              </div>
            ),
          },
          {
            key: "daysOutstanding",
            header: "Days outstanding",
            numeric: true,
            cell: (row) => row.daysOutstanding ?? "–",
          },
          {
            key: "cost",
            header: "Cost (RM)",
            numeric: true,
            cell: (row) => (row.cost === null ? "–" : formatRm(row.cost)),
          },
          {
            key: "margin",
            header: "Margin (RM)",
            numeric: true,
            cell: (row) => (row.margin ? formatRm(row.margin.margin) : "–"),
          },
          {
            key: "marginPct",
            header: "Margin %",
            numeric: true,
            cell: (row) => percent(row.margin?.marginPct ?? null),
          },
          {
            key: "area",
            header: "Total m²",
            numeric: true,
            cell: (row) => row.areaM2.toLocaleString("en-MY"),
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
              <StatusBadge tone={MOF_STAGE_TONE[row.stage]}>
                {MofStageLabel[row.stage]}
              </StatusBadge>
            ),
          },
        ]}
      />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}
