import { FileText, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { DataTable } from "@/components/app/data-table";
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
import { canEditRegister } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { isFinalStage, MOF_STAGE_TONE } from "@/lib/domain/mof-stages";
import {
  needsSupplierPo,
  orderTotal,
  totalAreaM2,
} from "@/lib/domain/mof-totals";
import {
  hasLiveSupplierPo,
  SUPPLIER_PO_STATUSES,
} from "@/lib/domain/supplier-po";
import { formatDate } from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import { createClient } from "@/lib/supabase/server";
import { parseMofFilters, seesOnlyOwnMofs, visibleMofs } from "./mof-filters";
import { LineUnit, MofStage, MofStageLabel, StockType } from "./schemas";
import { StageSelect } from "./stage-select";

export const metadata: Metadata = { title: "MOF Register" };

const ALL = "all";

const mofRows = z.array(
  z.object({
    id: z.string(),
    mof_no: z.string(),
    loa_date: z.string(),
    salesperson_id: z.string(),
    second_salesperson_id: z.string().nullable(),
    company_name: z.string(),
    project_name: z.string(),
    contract_sum: z.number(),
    vo_amount: z.number(),
    delivery_date: z.string().nullable(),
    stage: MofStage,
    latest_update: z.string().nullable(),
    payment_checked: z.boolean(),
    approvals_in_writing: z.boolean(),
    artwork_signed_off: z.boolean(),
    dos_pre_approved: z.boolean(),
    mof_lines: z.array(
      z.object({
        stock_type: StockType,
        qty: z.number(),
        unit: LineUnit,
        area_m2: z.number(),
      }),
    ),
    supplier_pos: z.array(z.object({ status: z.enum(SUPPLIER_PO_STATUSES) })),
  }),
);

type RegisterRow = {
  id: string;
  mofNo: string;
  loaDate: string;
  salespersonId: string;
  secondSalespersonId: string | null;
  people: string;
  companyName: string;
  projectName: string;
  total: number;
  deliveryDate: string | null;
  stage: MofStage;
  latestUpdate: string | null;
  ticks: number;
  /** Needs a supplier PO (indent, custom made or big order) and has none yet. */
  missingSupplierPo: boolean;
};

export default async function MofRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireSection("mof");
  const filters = parseMofFilters(await searchParams);
  const ownOnly = seesOnlyOwnMofs(me.jobRole);
  const canEdit = canEditRegister(me.jobRole);
  const supabase = await createClient();

  const [mofsResult, team] = await Promise.all([
    supabase
      .from("mofs")
      .select(
        "id, mof_no, loa_date, salesperson_id, second_salesperson_id, company_name, project_name, contract_sum, vo_amount, delivery_date, stage, latest_update, payment_checked, approvals_in_writing, artwork_signed_off, dos_pre_approved, mof_lines(stock_type, qty, unit, area_m2), supplier_pos(status)",
      )
      .order("loa_date", { ascending: false })
      .order("mof_no", { ascending: false }),
    getTeamDirectory(),
  ]);
  if (mofsResult.error) {
    throw new Error(`Could not load MOFs: ${mofsResult.error.message}`);
  }
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const personName = (id: string) => nameOf.get(id) ?? "Unnamed";

  const all: RegisterRow[] = mofRows.parse(mofsResult.data).map((row) => {
    const lines = row.mof_lines.map((line) => ({
      stockType: line.stock_type,
      qty: line.qty,
      unit: line.unit,
      areaM2: line.area_m2,
    }));
    return {
      id: row.id,
      mofNo: row.mof_no,
      loaDate: row.loa_date,
      salespersonId: row.salesperson_id,
      secondSalespersonId: row.second_salesperson_id,
      people: [
        personName(row.salesperson_id),
        row.second_salesperson_id
          ? personName(row.second_salesperson_id)
          : null,
      ]
        .filter(Boolean)
        .join(" + "),
      companyName: row.company_name,
      projectName: row.project_name,
      total: orderTotal({
        contractSum: row.contract_sum,
        voAmount: row.vo_amount,
      }),
      deliveryDate: row.delivery_date,
      stage: row.stage,
      latestUpdate: row.latest_update,
      ticks: [
        row.payment_checked,
        row.approvals_in_writing,
        row.artwork_signed_off,
        row.dos_pre_approved,
      ].filter(Boolean).length,
      missingSupplierPo:
        !isFinalStage(row.stage) &&
        needsSupplierPo(lines, totalAreaM2(lines)) &&
        !hasLiveSupplierPo(row.supplier_pos),
    };
  });
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
          canEdit ? (
            <Button asChild>
              <Link href="/mofs/new">
                <Plus data-icon="inline-start" />
                Register new MOF
              </Link>
            </Button>
          ) : undefined
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
