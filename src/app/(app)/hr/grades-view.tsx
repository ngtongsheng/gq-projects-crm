import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { currentScheme, splitPolicies } from "@/lib/domain/hr-policy";
import { targetOverBasic } from "@/lib/domain/hr-scheme";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import { LeaveSection } from "../leave/leave-section";
import { BonusBands } from "./bonus-bands";
import {
  AppendixSignedInput,
  GradeAmountInput,
  PersonGradeSelect,
} from "./grade-inputs";
import type { loadGradesData } from "./grades-data";
import { buildGradeRows, type GradeRow } from "./grades-rows";
import type { SchemeGrade } from "./policy-data";

const Sub = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-xs font-normal text-muted-foreground">
    {children}
  </span>
);

function gradeColumns(t: Translate): DataTableColumn<SchemeGrade>[] {
  return [
    { key: "grade", header: t("Grade"), cell: (g) => <b>{g.grade}</b> },
    {
      key: "basic",
      header: t("Basic / month"),
      numeric: true,
      cell: (g) => (
        <GradeAmountInput
          grade={g.grade}
          field="basic"
          value={g.basic}
          label={t("Basic / month")}
        />
      ),
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
      cell: (g) => (
        <GradeAmountInput
          grade={g.grade}
          field="annualTarget"
          value={g.annualTarget}
          label={t("Annual target")}
        />
      ),
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
}

function personColumns(t: Translate): DataTableColumn<GradeRow>[] {
  return [
    {
      key: "name",
      header: t("Name"),
      cell: (row) => (
        <span className="font-medium">
          {row.name}
          <Sub>{row.positionLabel}</Sub>
        </span>
      ),
    },
    {
      key: "grade",
      header: t("Grade"),
      cell: (row) => (
        <PersonGradeSelect
          personId={row.personId}
          name={row.name}
          grade={row.grade}
        />
      ),
    },
    {
      key: "basic",
      header: t("Basic / month"),
      numeric: true,
      cell: (row) =>
        row.basic === null ? (
          "-"
        ) : (
          <>
            {formatRm(row.basic)}
            <Sub>
              {row.basicFromPackage
                ? t("from staff package")
                : t("grade's basic")}
            </Sub>
          </>
        ),
    },
    {
      key: "target",
      header: t("Grade target"),
      numeric: true,
      className: "max-sm:hidden",
      cell: (row) =>
        row.gradeTarget === null ? "-" : formatRm(row.gradeTarget),
    },
    {
      key: "appendix",
      header: t("Appendix signed"),
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <AppendixSignedInput
            personId={row.personId}
            name={row.name}
            signedOn={row.appendixSignedOn}
          />
          {row.appendix === "not_signed" && (
            <StatusBadge tone="warn">{t("not signed")}</StatusBadge>
          )}
          {row.appendix === "older_version" && (
            <StatusBadge tone="warn">
              {t("signed version")} {row.appendixVersion} {"·"}{" "}
              {t("needs the new one")}
            </StatusBadge>
          )}
          {row.appendix === "signed" && row.appendixVersion && (
            <span className="text-xs text-muted-foreground">
              {t("version")} {row.appendixVersion}
            </span>
          )}
        </div>
      ),
    },
  ];
}

/** The demo's Sales grades & bonus view: the grade table, the bonus bands as a reference, and each salesperson's grade and signed appendix. */
export function GradesView({
  data,
  nameOf,
  today,
  t,
}: {
  data: Awaited<ReturnType<typeof loadGradesData>>;
  nameOf: (personId: string) => string;
  today: string;
  t: Translate;
}) {
  const scheme = currentScheme(splitPolicies(data.documents).current);
  const schemeVersion = scheme?.version ?? null;
  const rows = buildGradeRows({ ...data, schemeVersion, nameOf, today });

  return (
    <>
      <LeaveSection
        title={t("Sales grades, basic salary & targets")}
        note={t("Tap a number to change it")}
      >
        <DataTable
          columns={gradeColumns(t)}
          rows={data.grades}
          getRowKey={(g) => g.grade}
        />
        <p className="text-sm text-muted-foreground">
          {t(
            "Promotion is not automatic. A grade's basic is used when a person has no staff package recorded.",
          )}
        </p>
      </LeaveSection>
      <LeaveSection
        title={t("Performance bonus")}
        note={t("Reference only. GQP Office does not work out bonuses.")}
      >
        <BonusBands t={t} />
      </LeaveSection>
      <LeaveSection
        title={t("Sales grades & packages")}
        note={`${t("Scheme version")} ${schemeVersion ?? "-"}`}
      >
        <DataTable
          columns={personColumns(t)}
          rows={rows}
          getRowKey={(row) => row.personId}
          empty={<EmptyState title={t("No salespeople yet")} />}
        />
        <p className="text-sm text-muted-foreground">
          {t(
            "When a new version of the scheme is issued, people who signed an older version are flagged.",
          )}
        </p>
      </LeaveSection>
    </>
  );
}
