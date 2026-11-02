import { DataTable } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import type { Profile } from "@/lib/auth/current-profile";
import { isManager } from "@/lib/auth/job-role";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  type AttentionKey,
  attentionItems,
  attentionKeysFor,
} from "@/lib/domain/attention";
import { creditNoteState } from "@/lib/domain/leftover";
import { MOF_STAGE_LABEL, MOF_STAGE_TONE } from "@/lib/domain/mof-stages";
import {
  agedBalances,
  salespersonRows,
  salesTotals,
  stageRows,
} from "@/lib/domain/order-rollup";
import { holdState } from "@/lib/domain/reservation";
import { SUPPLIER_PO_STATUS_LABEL } from "@/lib/domain/supplier-po";
import { todayMyt } from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import { loadActiveSites } from "../site-work/site-work-data";
import { loadLeftovers } from "../stock/leftover/leftover-data";
import { loadReservations } from "../stock/stock-data";
import { loadStockSettings } from "../stock/stock-settings";
import { loadDashboardOrders } from "./dashboard-orders";
import {
  AttentionPanel,
  PanelEmpty,
  StatTile,
  TableSection,
  TileGrid,
} from "./dashboard-parts";
import { loadPurchasingFacts } from "./purchasing-data";

const MOF_ATTENTION_KEYS: readonly AttentionKey[] = [
  "overdueSupplierPos",
  "missingSupplierPos",
  "unsignedDos",
  "stockHolds",
  "creditNotes",
];

/**
 * Orders, purchasing and shipment, for Purchasing and for the MD's MOF and projects view.
 * Payment figures show only for managers: the database hides payments from Purchasing.
 */
export async function SupportDashboard({ me }: { me: Profile }) {
  const today = todayMyt();
  const showMoney = isManager(me.jobRole);
  const wants = (key: AttentionKey) =>
    attentionKeysFor(me.jobRole).includes(key);
  const [orders, purchasing, sites, reservations, settings, leftovers, names] =
    await Promise.all([
      loadDashboardOrders(),
      loadPurchasingFacts(today),
      wants("overdueFollowUps") ? loadActiveSites(today) : [],
      wants("stockHolds") ? loadReservations() : [],
      wants("stockHolds") ? loadStockSettings() : null,
      wants("creditNotes") ? loadLeftovers() : [],
      showMoney ? getTeamDirectory() : [],
    ]);
  // HR & Accounts opens this view read-only and has nothing here to act on.
  const showsAttention = MOF_ATTENTION_KEYS.some(wants);
  const nameOf = new Map(names.map((member) => [member.id, member.name]));
  const totals = salesTotals(orders, today);
  const unpaid = orders.filter((order) => order.outstanding > 0);
  const open = orders.filter((order) => order.stage !== "closed");

  const attention = attentionItems(me.jobRole, {
    overdueSupplierPos: purchasing.overduePos,
    missingSupplierPos: purchasing.missingPos,
    unsignedDos: purchasing.unsignedDos,
    stockHolds: settings
      ? reservations.filter(
          (line) => holdState(line, today, settings.warningDays) !== null,
        ).length
      : 0,
    creditNotes: leftovers.filter(
      (item) => creditNoteState(item)?.kind === "pending",
    ).length,
    overdueFollowUps: sites.reduce(
      (total, site) => total + site.overdueFollowUps,
      0,
    ),
  });

  return (
    <div className="flex flex-col gap-4">
      {showsAttention ? <AttentionPanel items={attention} /> : null}
      <TileGrid>
        <StatTile
          label="New MOFs this month"
          value={totals.month.count}
          note={`${formatRm(totals.month.value)} in orders`}
        />
        <StatTile
          label="Sales this year"
          value={formatRm(totals.year.value)}
          note={`${totals.year.count} MOFs`}
        />
        {showMoney ? (
          <StatTile
            label="Balance not yet received"
            value={formatRm(sumRm(unpaid.map((order) => order.outstanding)))}
            note={`${unpaid.length} MOFs with a balance`}
          />
        ) : null}
        <StatTile
          label="Open orders"
          value={open.length}
          note="Not closed or cancelled"
        />
        <StatTile
          label="DOs not signed back"
          value={purchasing.unsignedDos}
          note="Delivered, signed copy not yet returned"
        />
      </TileGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <TableSection title="Order status" aside="All MOFs">
          <DataTable
            rows={stageRows(orders)}
            getRowKey={(row) => row.stage}
            columns={[
              {
                key: "stage",
                header: "Stage",
                cell: (row) => (
                  <StatusBadge tone={MOF_STAGE_TONE[row.stage]}>
                    {MOF_STAGE_LABEL[row.stage]}
                  </StatusBadge>
                ),
              },
              {
                key: "count",
                header: "MOFs",
                numeric: true,
                cell: (row) => row.count,
              },
              {
                key: "invoice",
                header: "Invoice",
                numeric: true,
                cell: (row) => (row.count ? formatRm(row.invoice) : "-"),
              },
              ...(showMoney
                ? [
                    {
                      key: "balance",
                      header: "Balance",
                      numeric: true,
                      cell: (row: { outstanding: number }) =>
                        row.outstanding ? formatRm(row.outstanding) : "-",
                    },
                  ]
                : []),
            ]}
          />
        </TableSection>
        <TableSection title="Purchasing and shipment" aside="Supplier POs">
          <DataTable
            rows={purchasing.poStatuses}
            getRowKey={(row) => row.status}
            columns={[
              {
                key: "status",
                header: "Status",
                cell: (row) => SUPPLIER_PO_STATUS_LABEL[row.status],
              },
              {
                key: "count",
                header: "POs",
                numeric: true,
                cell: (row) => row.count,
              },
              {
                key: "late",
                header: "Past expected arrival",
                numeric: true,
                cell: (row) =>
                  row.late > 0 ? (
                    <StatusBadge tone="bad">{row.late}</StatusBadge>
                  ) : (
                    "-"
                  ),
              },
            ]}
          />
        </TableSection>
      </div>
      {showMoney ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <TableSection
            title="Unpaid balance by age"
            aside="Days since invoice date"
          >
            <DataTable
              rows={agedBalances(orders, today)}
              getRowKey={(row) => row.label}
              columns={[
                { key: "age", header: "Age", cell: (row) => row.label },
                {
                  key: "count",
                  header: "MOFs",
                  numeric: true,
                  cell: (row) => row.count,
                },
                {
                  key: "balance",
                  header: "Balance",
                  numeric: true,
                  cell: (row) =>
                    row.outstanding ? formatRm(row.outstanding) : "-",
                },
              ]}
            />
          </TableSection>
          <TableSection title="Salesperson snapshot" aside="Sales this year">
            <DataTable
              rows={salespersonRows(orders, today).sort(
                (a, b) => b.yearValue - a.yearValue,
              )}
              getRowKey={(row) => row.personId}
              empty={<PanelEmpty>No orders yet.</PanelEmpty>}
              columns={[
                {
                  key: "name",
                  header: "Salesperson",
                  cell: (row) => nameOf.get(row.personId) ?? "Unnamed",
                },
                {
                  key: "sales",
                  header: "Sales",
                  numeric: true,
                  cell: (row) => formatRm(row.yearValue),
                },
                {
                  key: "count",
                  header: "MOFs",
                  numeric: true,
                  cell: (row) => row.yearCount,
                },
                {
                  key: "balance",
                  header: "Outstanding",
                  numeric: true,
                  cell: (row) =>
                    row.outstanding ? formatRm(row.outstanding) : "-",
                },
              ]}
            />
          </TableSection>
        </div>
      ) : null}
    </div>
  );
}
