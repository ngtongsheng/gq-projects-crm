import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import {
  ALLOWANCE_LABEL,
  allowanceTotal,
  HOTEL_LEVEL_LABEL,
  HOTEL_LEVELS,
  mealsPerDay,
  monthlyTotal,
  type OutstationRules,
  type StandardPackages,
  type StandardPosition,
} from "@/lib/domain/staff-package";
import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import { StatTile, TileGrid } from "../dashboard/dashboard-parts";
import { LeaveSection } from "../leave/leave-section";
import { OutstationDialog } from "./outstation-dialog";
import type { loadStaffData } from "./staff-data";
import { StaffPackageDialog } from "./staff-package-dialog";
import { buildStaffRows, STANDARD_TITLE, type StaffRow } from "./staff-rows";
import { StandardPackageDialog } from "./standard-package-dialog";

const Money = ({ value }: { value: number }) => (
  <span className="font-mono tabular-nums">{formatRm(value)}</span>
);

const Sub = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-xs font-normal text-muted-foreground">
    {children}
  </span>
);

function StandardPackagesSection({
  standards,
  t,
}: {
  standards: StandardPackages;
  t: Translate;
}) {
  return (
    <LeaveSection
      title={t("Standard packages")}
      note={t(
        "The usual allowances and claim cap. The cap can differ by person: set it on their package.",
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(standards) as StandardPosition[]).map((position) => {
          const standard = standards[position];
          const title = t(STANDARD_TITLE[position]);
          return (
            <div
              key={position}
              className="flex flex-col gap-2 rounded-xl border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{title}</h3>
                <StandardPackageDialog
                  position={position}
                  title={title}
                  standard={standard}
                />
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {standard.allowances.length === 0 && (
                  <li className="text-muted-foreground">
                    {t("No fixed allowance set")}
                  </li>
                )}
                {standard.allowances.map((allowance) => (
                  <li
                    key={allowance.name}
                    className="flex justify-between gap-3"
                  >
                    <span>{t(ALLOWANCE_LABEL[allowance.name])}</span>
                    <Money value={allowance.amount} />
                  </li>
                ))}
                <li className="flex justify-between gap-3 border-t pt-1">
                  <span>{t("Petrol + toll + parking claim (max)")}</span>
                  {standard.claimCap === null ? (
                    "-"
                  ) : (
                    <span>
                      <Money value={standard.claimCap} /> / {t("month")}
                    </span>
                  )}
                </li>
              </ul>
            </div>
          );
        })}
      </div>
    </LeaveSection>
  );
}

function OutstationSection({
  rules,
  t,
}: {
  rules: OutstationRules;
  t: Translate;
}) {
  const meals = [
    ["Breakfast", rules.breakfast],
    ["Lunch", rules.lunch],
    ["Dinner", rules.dinner],
  ] as const;
  return (
    <LeaveSection
      title={t("Outstation rules")}
      note={t(
        "Meals are a fixed allowance, no receipt. Hotel is claimed by receipt, up to the budget per night.",
      )}
      action={<OutstationDialog rules={rules} />}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <h3 className="font-medium">{t("Meals per day")}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {meals.map(([label, amount]) => (
              <li key={label} className="flex justify-between gap-3">
                <span>{t(label)}</span>
                <Money value={amount} />
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t pt-1">
              <span>{t("Full day")}</span>
              <Money value={mealsPerDay(rules)} />
            </li>
          </ul>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <h3 className="font-medium">
            {t("Hotel budget per night (by receipt)")}
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {HOTEL_LEVELS.map((level) => (
              <li key={level} className="flex justify-between gap-3">
                <span>{t(HOTEL_LEVEL_LABEL[level])}</span>
                <span>
                  {t("up to")} <Money value={rules.hotel[level]} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </LeaveSection>
  );
}

function columnsFor(t: Translate): DataTableColumn<StaffRow>[] {
  return [
    {
      key: "name",
      header: t("Name"),
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "position",
      header: t("Position"),
      className: "max-sm:hidden",
      cell: (row) => row.positionLabel,
    },
    {
      key: "joined",
      header: t("Joined"),
      className: "max-md:hidden",
      cell: (row) => (
        <span className="font-mono tabular-nums">
          {row.joinedOn ? formatDate(row.joinedOn) : "-"}
          {row.confirmedOn && (
            <Sub>
              {t("confirmed")} {formatDate(row.confirmedOn)}
            </Sub>
          )}
        </span>
      ),
    },
    {
      key: "basic",
      header: t("Basic"),
      numeric: true,
      cell: (row) =>
        row.current ? (
          formatRm(row.current.basic)
        ) : (
          <span className="font-sans text-muted-foreground">
            {t("not recorded")}
          </span>
        ),
    },
    {
      key: "allowances",
      header: t("Allowances"),
      numeric: true,
      className: "max-lg:hidden",
      cell: (row) => {
        if (!row.current) return null;
        const sum = allowanceTotal(row.current.allowances);
        return (
          <>
            {sum > 0 ? formatRm(sum) : "-"}
            {row.current.allowances.length > 0 && (
              <Sub>
                {row.current.allowances
                  .map((allowance) =>
                    t(ALLOWANCE_LABEL[allowance.name]).replace(
                      / allowance$/i,
                      "",
                    ),
                  )
                  .join(", ")}
              </Sub>
            )}
          </>
        );
      },
    },
    {
      key: "claimCap",
      header: t("Claim cap"),
      numeric: true,
      className: "max-lg:hidden",
      cell: (row) => (row.claimCap ? formatRm(row.claimCap) : "-"),
    },
    {
      key: "total",
      header: t("Total / month"),
      numeric: true,
      cell: (row) =>
        row.current ? (
          <span className="font-semibold">
            {formatRm(monthlyTotal(row.current))}
          </span>
        ) : null,
    },
    {
      key: "since",
      header: t("Since"),
      className: "max-md:hidden",
      cell: (row) => (
        <span className="font-mono tabular-nums">
          {row.current ? formatDate(row.current.effectiveOn) : null}
          {row.changes > 1 && (
            <Sub>
              {row.changes} {t("changes")}
            </Sub>
          )}
          {row.next && (
            <span className="block text-xs text-info">
              {"→"} {formatRm(row.next.basic)} {t("from")}{" "}
              {formatDate(row.next.effectiveOn)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "open",
      header: "",
      cell: (row) => (
        <StaffPackageDialog
          sheet={row.sheet}
          hasPackage={row.sheet.history.length > 0}
        />
      ),
    },
  ];
}

/** The demo's Staff packages view: standard packages, outstation rules, headline totals, then everyone's current package. */
export function StaffView({
  data,
  nameOf,
  today,
  t,
}: {
  data: Awaited<ReturnType<typeof loadStaffData>>;
  nameOf: (personId: string) => string;
  today: string;
  t: Translate;
}) {
  const {
    rows,
    withoutPackage,
    monthlyTotal: total,
  } = buildStaffRows({
    ...data,
    nameOf,
    today,
  });
  return (
    <>
      <StandardPackagesSection standards={data.standards} t={t} />
      <OutstationSection rules={data.outstation} t={t} />
      <TileGrid>
        <StatTile
          label={t("Staff")}
          value={rows.length}
          note={
            withoutPackage > 0
              ? `${withoutPackage} ${t("without package recorded")}`
              : t("all recorded")
          }
        />
        <StatTile
          label={t("Monthly basic + allowances")}
          value={formatRm(total)}
          note={t("Before EPF / SOCSO / EIS employer share")}
        />
        <StatTile
          label={t("Yearly (x 12)")}
          value={formatRm(total * 12)}
          note={t("Excludes bonus & commission")}
        />
      </TileGrid>
      <LeaveSection
        title={t("Current staff packages")}
        note={t(
          "Open a person to record or change their package. Changes are kept as history.",
        )}
      >
        <DataTable
          columns={columnsFor(t)}
          rows={rows}
          getRowKey={(row) => row.personId}
          empty={<EmptyState title={t("No staff yet")} />}
        />
        <p className="text-sm text-muted-foreground">
          {t(
            "Only the Managing Director and HR & Accounts can see this. Commission and bonus are not included.",
          )}
        </p>
      </LeaveSection>
    </>
  );
}
