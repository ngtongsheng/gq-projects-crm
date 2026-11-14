import { Banknote } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { canEnterPayments } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { summariseCollection } from "@/lib/domain/collection";
import { formatDate, todayMyt } from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import { seesOnlyOwnMofs } from "../mofs/mof-filters";
import { loadCollectionOrders, loadPaymentThreshold } from "./collection-data";
import { PaymentsDialog } from "./payments-dialog";

export const metadata: Metadata = { title: "Collection" };

export default async function CollectionPage() {
  const me = await requirePage("coll");
  const [orders, threshold, team] = await Promise.all([
    loadCollectionOrders(),
    loadPaymentThreshold(),
    getTeamDirectory(),
  ]);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const canEnter = canEnterPayments(me.jobRole);
  const ownOnly = seesOnlyOwnMofs(me.jobRole);
  const today = todayMyt();

  // Salespeople only ever see their own orders, whatever the address bar says.
  const rows = orders
    .filter(
      (order) =>
        !ownOnly ||
        order.salespersonId === me.id ||
        order.secondSalespersonId === me.id,
    )
    .map((order) => ({
      ...order,
      summary: summariseCollection(
        order.invoice,
        order.payments.map((payment) => payment.amount),
        threshold,
      ),
    }));
  const totalOutstanding = sumRm(rows.map((row) => row.summary.outstanding));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Collection"
        description={
          ownOnly
            ? "Payments on the orders registered under your name."
            : `Invoice, received and outstanding per order. Commission opens at ${threshold}% paid.`
        }
      />
      <p className="font-mono text-sm tabular-nums text-muted-foreground">
        {rows.length} orders · {formatRm(totalOutstanding)} outstanding
      </p>
      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={Banknote}
            title="No orders to collect on"
            description="Orders appear here once an MOF is registered."
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
          {
            key: "salesperson",
            header: "Salesperson",
            cell: (row) =>
              [row.salespersonId, row.secondSalespersonId]
                .flatMap((id) => (id ? [nameOf.get(id) ?? "Unnamed"] : []))
                .join(" + "),
          },
          {
            key: "invoice",
            header: "Invoice",
            numeric: true,
            cell: (row) => formatRm(row.summary.invoice),
          },
          {
            key: "received",
            header: "Received",
            numeric: true,
            cell: (row) => (
              <div className="flex flex-col items-end">
                <span>{formatRm(row.summary.received)}</span>
                {row.payments[0] && (
                  <span className="text-xs text-muted-foreground">
                    Last {formatDate(row.payments[0].receivedOn)}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "outstanding",
            header: "Outstanding",
            numeric: true,
            cell: (row) => formatRm(row.summary.outstanding),
          },
          {
            key: "status",
            header: "Status",
            cell: (row) => (
              <div className="flex flex-col items-start gap-1">
                <StatusBadge tone={row.summary.tone}>
                  {row.summary.label}
                </StatusBadge>
                {row.summary.overpaid > 0 && (
                  <span className="text-xs text-warn">
                    Overpaid by {formatRm(row.summary.overpaid)}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "payments",
            header: "",
            cell: (row) => (
              <PaymentsDialog
                mofId={row.id}
                title={`${row.mofNo} · ${row.projectName}`}
                outstanding={row.summary.outstanding}
                payments={row.payments}
                canEnter={canEnter}
                today={today}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
