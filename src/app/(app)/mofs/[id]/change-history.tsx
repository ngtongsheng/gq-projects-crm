import { z } from "zod";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOF_CHANGE_FIELDS, type MofChangeField } from "@/lib/domain/mof-diff";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { AccountType, AccountTypeLabel } from "../../customers/schemas";
import { JobScope, JobScopeLabel } from "../schemas";

export const MOF_CHANGE_COLUMNS =
  "id, field, old_value, new_value, reason, changed_by, created_at";

export const mofChangeRows = z.array(
  z.object({
    id: z.string(),
    field: z.enum(MOF_CHANGE_FIELDS),
    old_value: z.string().nullable(),
    new_value: z.string().nullable(),
    reason: z.string().nullable(),
    changed_by: z.string().nullable(),
    created_at: z.string(),
  }),
);
type MofChangeRow = z.infer<typeof mofChangeRows>[number];

const FIELD_LABEL: Record<MofChangeField, string> = {
  contract_sum: "Contract sum",
  cost: "Cost",
  installer_name: "Installer",
  scope: "Job scope",
  salesperson_id: "Salesperson",
  second_salesperson_id: "Second salesperson",
  commission_type: "Commission type",
  loa_date: "LOA date",
  lines: "Products",
  order_total: "Order total",
};

/** A stored value as people read it; values are kept raw so labels and names stay current. */
function shown(
  field: MofChangeField,
  value: string | null,
  nameOf: ReadonlyMap<string, string>,
): string {
  if (value === null) return "–";
  switch (field) {
    case "contract_sum":
    case "cost":
    case "order_total":
      return formatRm(Number(value));
    case "scope": {
      const scope = JobScope.safeParse(value);
      return scope.success ? JobScopeLabel[scope.data] : value;
    }
    case "commission_type": {
      const type = AccountType.safeParse(value);
      return type.success ? AccountTypeLabel[type.data] : value;
    }
    case "salesperson_id":
    case "second_salesperson_id":
      return nameOf.get(value) ?? "Unnamed";
    case "loa_date":
      return formatDate(value);
    default:
      return value;
  }
}

/** Every recorded change to the MOF, newest first. Cost rows reach only cost readers. */
export function ChangeHistory({
  rows,
  nameOf,
}: {
  rows: MofChangeRow[];
  nameOf: ReadonlyMap<string, string>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Change history</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={[
            {
              key: "at",
              header: "When",
              cell: (row) => formatDateTime(row.created_at),
              numeric: true,
            },
            {
              key: "field",
              header: "Field",
              cell: (row) => FIELD_LABEL[row.field],
            },
            {
              key: "from",
              header: "From",
              cell: (row) => shown(row.field, row.old_value, nameOf),
            },
            {
              key: "to",
              header: "To",
              cell: (row) => shown(row.field, row.new_value, nameOf),
            },
            {
              key: "reason",
              header: "Reason",
              cell: (row) => row.reason ?? "",
            },
            {
              key: "by",
              header: "By",
              cell: (row) =>
                row.changed_by
                  ? (nameOf.get(row.changed_by) ?? "Unnamed")
                  : "–",
            },
          ]}
          rows={rows}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              title="No changes yet"
              description="Changes to the contract, cost, installer, scope, salespeople, commission type, LOA date, products and order total are listed here."
            />
          }
        />
      </CardContent>
    </Card>
  );
}
