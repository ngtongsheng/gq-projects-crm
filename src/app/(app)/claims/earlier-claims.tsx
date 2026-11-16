import { DataTable } from "@/components/app/data-table";
import { formatMonth } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import { ClaimStatusBadge } from "./claim-status-badge";
import type { ClaimSummary } from "./my-claim-data";

/** The person's other claims with what each came to and where it stands. */
export function EarlierClaims({
  claims,
  t,
}: {
  claims: ClaimSummary[];
  t: Translate;
}) {
  if (claims.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-lg font-semibold">
        {t("Earlier claims")}
      </h2>
      <DataTable
        columns={[
          {
            key: "month",
            header: t("Month"),
            cell: (claim) => formatMonth(claim.month),
          },
          {
            key: "commission",
            header: t("Commission"),
            numeric: true,
            cell: (claim) => formatRm(claim.commission),
          },
          {
            key: "expenses",
            header: t("Expense"),
            numeric: true,
            cell: (claim) => formatRm(claim.expenses),
          },
          {
            key: "status",
            header: t("Status"),
            cell: (claim) => <ClaimStatusBadge status={claim.status} t={t} />,
          },
        ]}
        rows={claims}
        getRowKey={(claim) => claim.month}
      />
    </section>
  );
}
