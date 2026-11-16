import type { ReactNode } from "react";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import type { CommissionSettings } from "@/lib/domain/commission-settings";
import {
  ratesMatchScheme,
  SCHEME_CLAIM_THRESHOLD_PCT,
  SCHEME_RATES,
  targetOverBasic,
} from "@/lib/domain/hr-scheme";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import { LeaveSection } from "../leave/leave-section";
import { BonusBands } from "./bonus-bands";
import type { SchemeGrade } from "./policy-data";

const Pct = ({ value }: { value: number }) => (
  <span className="font-mono tabular-nums">{value}%</span>
);

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium">{title}</h3>
      {children}
    </div>
  );
}

/** Rows of text with an optional right-hand value and status. */
function Rows({
  rows,
}: {
  rows: {
    key: string;
    text: ReactNode;
    value?: ReactNode;
    status?: ReactNode;
  }[];
}) {
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((row) => (
        <li
          key={row.key}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
        >
          <span className="mr-auto min-w-0">{row.text}</span>
          {row.value}
          {/* The long "not checked yet" note must wrap on a phone instead of widening the page. */}
          {row.status && (
            <span className="min-w-0 max-w-full [&>*]:h-auto [&>*]:whitespace-normal [&>*]:text-left">
              {row.status}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

const status = (tone: StatusTone, text: string) => (
  <StatusBadge tone={tone}>{text}</StatusBadge>
);

/**
 * The demo's scheme summary: grades, bonus bands, commission rates and terms. The signed appendix
 * is the official document; this only shows it next to what the app now does.
 */
export function SchemeSummary({
  version,
  grades,
  commission,
  t,
}: {
  version: string;
  grades: SchemeGrade[];
  commission: CommissionSettings;
  t: Translate;
}) {
  const match = ratesMatchScheme(commission.baseRatePct);
  const sharedRate = commission.baseRatePct.pass_down;
  const claimMatches =
    commission.claimThresholdPct === SCHEME_CLAIM_THRESHOLD_PCT;

  const gradeColumns: DataTableColumn<SchemeGrade>[] = [
    { key: "grade", header: t("Grade"), cell: (g) => <b>{g.grade}</b> },
    {
      key: "basic",
      header: t("Basic / month"),
      numeric: true,
      cell: (g) => (g.basic === null ? "-" : formatRm(g.basic)),
    },
    {
      key: "monthly",
      header: t("Monthly target"),
      numeric: true,
      className: "max-sm:hidden",
      cell: (g) => formatRm(Math.round(g.annualTarget / 12)),
    },
    {
      key: "annual",
      header: t("Annual target"),
      numeric: true,
      cell: (g) => formatRm(g.annualTarget),
    },
    {
      key: "ratio",
      header: t("Target / basic"),
      numeric: true,
      className: "max-sm:hidden",
      cell: (g) => {
        const ratio = targetOverBasic(g.annualTarget, g.basic);
        return ratio === null ? "-" : `${ratio}x`;
      },
    },
    {
      key: "level",
      header: t("Role level"),
      className: "max-md:hidden",
      cell: (g) => g.description,
    },
  ];

  return (
    <LeaveSection
      title={`${t("Sales Target & Commission Scheme")} · ${t("version")} ${version}`}
      note={t("Summary. The signed appendix is the official document.")}
    >
      <div className="flex flex-col gap-5 rounded-xl border bg-card p-4">
        <Part title={`1 · ${t("Sales grades, basic salary & targets")}`}>
          <DataTable
            columns={gradeColumns}
            rows={grades}
            getRowKey={(g) => g.grade}
          />
          <p className="text-sm text-muted-foreground">
            {t(
              "J1 > J2 > J3 > S1 > S2 > S3 > SN1 > SN2 > SN3 > M1 > M2. Promotion is not automatic: it follows sales, consistency, gross profit, collection, new accounts, account and project management, customer relationship, CRM compliance, team contribution, leadership and overall contribution.",
            )}
          </p>
        </Part>
        <Part title={`2 · ${t("Performance bonus")}`}>
          <BonusBands t={t} />
        </Part>
        <Part title={`3 · ${t("Commission rates")}`}>
          <Rows
            rows={[
              {
                key: "own",
                text: t("Own effort / self-developed"),
                value: <Pct value={SCHEME_RATES.own} />,
                status: status(
                  match.own ? "good" : "warn",
                  `GQP Office ${commission.baseRatePct.own}%`,
                ),
              },
              {
                key: "shared",
                text: t("Company / shared / BD pass-down"),
                value: <Pct value={SCHEME_RATES.shared} />,
                status: status(
                  match.shared ? "good" : "warn",
                  `GQP Office ${sharedRate}%${
                    commission.baseRatePct.company === sharedRate
                      ? ""
                      : ` / ${commission.baseRatePct.company}%`
                  }`,
                ),
              },
              {
                key: "margin",
                text: t("Below minimum margin / special pricing"),
                value: <span>{t("Case by case")}</span>,
                status: status("good", t("management decides")),
              },
            ]}
          />
        </Part>
        <Part title={`4 · ${t("Commission terms")}`}>
          <Rows
            rows={[
              {
                key: "claim",
                text: t(
                  "Payable when at least 90% of customer payment is collected, based on actual amount collected",
                ),
                status: status(
                  claimMatches ? "good" : "warn",
                  `${t("GQP Office: claim opens at")} ${commission.claimThresholdPct}% ${t("paid")}`,
                ),
              },
              {
                key: "half",
                text: t(
                  "Only if the salesperson achieves at least 50% of the annual sales target",
                ),
                status: status(
                  "warn",
                  t(
                    "not checked by GQP Office yet. HR & Accounts checks before approving",
                  ),
                ),
              },
              {
                key: "active",
                text: t(
                  "Employee must be in active employment when commission is due",
                ),
                status: status("good", t("leavers stop at last day")),
              },
              {
                key: "adjusted",
                text: t(
                  "Adjusted for discount, credit note, cancellation, bad debt",
                ),
                status: status(
                  "good",
                  t("MOF changes and the claim adjustment"),
                ),
              },
            ]}
          />
        </Part>
      </div>
    </LeaveSection>
  );
}
