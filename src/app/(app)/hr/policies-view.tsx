import type { CommissionSettings } from "@/lib/domain/commission-settings";
import {
  currentScheme,
  type PolicyDocument,
  splitPolicies,
} from "@/lib/domain/hr-policy";
import type { Translate } from "@/lib/i18n/translate";
import { LeaveSection } from "../leave/leave-section";
import { ExtraRulesSection } from "./extra-rules-section";
import type { ExtraRule, SchemeGrade } from "./policy-data";
import { PolicyRow } from "./policy-row";
import { SchemeSummary } from "./scheme-summary";

/** The demo's Policies & schemes view: documents, the scheme summary, the extra rules log, then older versions. */
export function PoliciesView({
  documents,
  rules,
  grades,
  commission,
  leaveDays,
  showCommissionSettings,
  nameOf,
  today,
  t,
}: {
  documents: PolicyDocument[];
  rules: ExtraRule[];
  grades: SchemeGrade[];
  commission: CommissionSettings;
  leaveDays: { annual: number; mc: number };
  showCommissionSettings: boolean;
  nameOf: (personId: string) => string;
  today: string;
  t: Translate;
}) {
  const { current, older } = splitPolicies(documents);
  const scheme = currentScheme(current);
  const row = (document: PolicyDocument, isCurrent: boolean) => (
    <PolicyRow
      key={document.id}
      document={document}
      current={isCurrent}
      replaceable={current}
      today={today}
      t={t}
    />
  );

  return (
    <>
      <LeaveSection
        title={t("Current policies")}
        note={<span className="font-mono tabular-nums">{current.length}</span>}
      >
        <div className="overflow-hidden rounded-xl border bg-card">
          {current.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {t("No policies added yet.")}
            </p>
          ) : (
            <ul className="divide-y">{current.map((d) => row(d, true))}</ul>
          )}
        </div>
      </LeaveSection>
      {scheme && (
        <SchemeSummary
          version={scheme.version}
          grades={grades}
          commission={commission}
          t={t}
        />
      )}
      <ExtraRulesSection
        rules={rules}
        nameOf={nameOf}
        commission={commission}
        leaveDays={leaveDays}
        showCommissionSettings={showCommissionSettings}
        today={today}
        t={t}
      />
      {older.length > 0 && (
        <LeaveSection title={t("Older versions")}>
          <div className="overflow-hidden rounded-xl border bg-card">
            <ul className="divide-y">{older.map((d) => row(d, false))}</ul>
          </div>
        </LeaveSection>
      )}
    </>
  );
}
