import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { canApproveQuote } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { formatDateTime } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { MarginPill } from "../[id]/margin-pill";
import { loadQuotes } from "../quote-data";
import { QUOTE_STATUS_TONE, QuoteStatusLabel } from "../quote-status";
import type { QuoteView } from "../quote-view";

export const metadata: Metadata = { title: "Below min margin" };

const RECENT_LIMIT = 15;

type Revision = QuoteView["revisions"][number];

/** One option of a revision; the revision's own columns are filled on its first option only. */
type OptionRow = {
  key: string;
  first: boolean;
  quote: QuoteView;
  revision: Revision;
  option: Revision["options"][number];
};

const revisionName = (quoteNo: string, rev: number) =>
  rev > 0 ? `${quoteNo}-R${rev}` : quoteNo;

function optionRows(entries: { quote: QuoteView; revision: Revision }[]) {
  return entries.flatMap(({ quote, revision }) =>
    revision.options.map(
      (option, index): OptionRow => ({
        key: option.id,
        first: index === 0,
        quote,
        revision,
        option,
      }),
    ),
  );
}

const lastAt = (revision: Revision) =>
  revision.history.at(-1)?.at ?? revision.updatedAt;

export default async function CostingApprovalsPage() {
  const me = await requirePage("cost");
  const quotes = await loadQuotes(me);
  const approver = canApproveQuote(me.jobRole);
  const costShown = quotes[0]?.costShown ?? false;

  const revisions = quotes.flatMap((quote) =>
    quote.revisions.map((revision) => ({ quote, revision })),
  );
  const pending = revisions
    .filter(({ revision }) => revision.status === "submitted")
    .sort((a, b) => lastAt(a.revision).localeCompare(lastAt(b.revision)));
  // Only costings that went for approval: confirmed-at-minimum ones never came through here.
  const recent = revisions
    .filter(
      ({ revision }) =>
        (revision.status === "approved" || revision.status === "returned") &&
        revision.history.some((entry) => entry.action === "submitted"),
    )
    .sort((a, b) => lastAt(b.revision).localeCompare(lastAt(a.revision)))
    .slice(0, RECENT_LIMIT);

  const shared = (row: OptionRow, cell: ReactNode) => (row.first ? cell : null);
  const columns = (
    last: "Submitted" | "Decision",
  ): DataTableColumn<OptionRow>[] => [
    {
      key: "quoteNo",
      header: "Quotation No.",
      cell: (row) =>
        shared(
          row,
          <div className="flex flex-col gap-0.5">
            <Link
              href={`/costing/${row.quote.id}?rev=${row.revision.rev}`}
              className="font-mono font-medium hover:underline"
            >
              {revisionName(row.quote.quoteNo, row.revision.rev)}
            </Link>
            {row.revision.status === "submitted" && (
              <span className="text-xs text-muted-foreground">
                {approver
                  ? "You can approve"
                  : "Waiting for the MD or Sales Director"}
              </span>
            )}
          </div>,
        ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (row) => shared(row, row.quote.customerName),
    },
    {
      key: "project",
      header: "Project",
      cell: (row) => shared(row, row.quote.projectName),
    },
    {
      key: "salesperson",
      header: "Salesperson",
      cell: (row) => shared(row, row.quote.salespersonName),
    },
    {
      key: "option",
      header: "Option",
      cell: (row) => (
        <span>
          {row.revision.options.length > 1 && (
            <span className="font-medium">Option {row.option.key} </span>
          )}
          <span className="text-muted-foreground">{row.option.label}</span>
        </span>
      ),
    },
    ...(costShown
      ? [
          {
            key: "cost",
            header: "Total cost",
            numeric: true,
            cell: (row: OptionRow) =>
              "cost" in row.option ? formatRm(row.option.cost) : null,
          },
        ]
      : []),
    {
      key: "sell",
      header: "Quote amount",
      numeric: true,
      cell: (row) => formatRm(row.option.sell),
    },
    ...(costShown
      ? [
          {
            key: "profit",
            header: "Est. profit",
            numeric: true,
            cell: (row: OptionRow) =>
              "profit" in row.option ? formatRm(row.option.profit) : null,
          },
        ]
      : []),
    {
      key: "margin",
      header: "Margin",
      cell: (row) =>
        "margin" in row.option ? (
          <MarginPill costShown margin={row.option.margin} level={null} />
        ) : (
          <MarginPill
            costShown={false}
            margin={null}
            level={row.option.marginLevel}
          />
        ),
    },
    {
      key: "last",
      header: last,
      cell: (row) => {
        const entry = row.revision.history.at(-1);
        return shared(
          row,
          <div className="flex flex-col items-start gap-1">
            {last === "Decision" && (
              <StatusBadge tone={QUOTE_STATUS_TONE[row.revision.status]}>
                {QuoteStatusLabel[row.revision.status]}
              </StatusBadge>
            )}
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {last === "Decision" && entry ? `${entry.byName} · ` : ""}
              {formatDateTime(lastAt(row.revision))}
            </span>
          </div>,
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Below min margin"
        description="A costing whose lowest option meets the minimum margin is quoted straight away. Only lower ones come here for the MD or Sales Director to approve."
      />
      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold">
          Waiting for approval ·{" "}
          <span className="font-mono tabular-nums">{pending.length}</span>
        </h2>
        <DataTable
          rows={optionRows(pending)}
          getRowKey={(row) => row.key}
          columns={columns("Submitted")}
          empty={
            <EmptyState
              icon={CheckCircle2}
              title="Nothing waiting"
              description="No costing is waiting for approval."
            />
          }
        />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold">Recently decided</h2>
        <DataTable
          rows={optionRows(recent)}
          getRowKey={(row) => row.key}
          columns={columns("Decision")}
          empty={
            <EmptyState
              title="No decisions yet"
              description="Approved and returned costings appear here."
            />
          }
        />
      </section>
    </div>
  );
}
