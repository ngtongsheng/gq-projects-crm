import Link from "next/link";
import type { CommissionSettings } from "@/lib/domain/commission-settings";
import { formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { LeaveSection } from "../leave/leave-section";
import { AddRuleDialog } from "./add-rule-dialog";
import type { ExtraRule } from "./policy-data";
import { RemoveRuleButton } from "./remove-rule-button";

/** The demo's "Rules added after the appendix", with the settings other modules own. */
export function ExtraRulesSection({
  rules,
  nameOf,
  commission,
  leaveDays,
  showCommissionSettings,
  today,
  t,
}: {
  rules: ExtraRule[];
  nameOf: (personId: string) => string;
  commission: CommissionSettings;
  leaveDays: { annual: number; mc: number };
  /** Only those who may change commission rules get the link. */
  showCommissionSettings: boolean;
  today: string;
  t: Translate;
}) {
  const { firstLateCut, secondLateCut } = commission;
  return (
    <LeaveSection
      title={t("Rules added after the appendix")}
      action={<AddRuleDialog today={today} />}
    >
      <div className="overflow-hidden rounded-xl border bg-card">
        {rules.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t("None")}</p>
        ) : (
          <ul className="divide-y">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
              >
                <div className="mr-auto min-w-0">
                  <p className="text-sm">{rule.rule}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("From")} {formatDate(rule.startsOn)} ·{" "}
                    {nameOf(rule.addedBy)}
                  </p>
                </div>
                <RemoveRuleButton id={rule.id} />
              </li>
            ))}
          </ul>
        )}
        <div className="border-t px-4 py-3 text-sm text-muted-foreground">
          <p>
            {t("Settings in GQP Office now")}: {t("late cut")}{" "}
            <span className="font-mono tabular-nums">
              {firstLateCut.afterDays}
            </span>{" "}
            {t("days")} -
            <span className="font-mono tabular-nums">
              {firstLateCut.cutPct}
            </span>
            % /{" "}
            <span className="font-mono tabular-nums">
              {secondLateCut.afterDays}
            </span>{" "}
            {t("days")} -
            <span className="font-mono tabular-nums">
              {secondLateCut.cutPct}
            </span>
            % · {t("leave")}{" "}
            <span className="font-mono tabular-nums">{leaveDays.annual}</span>{" "}
            AL / <span className="font-mono tabular-nums">{leaveDays.mc}</span>{" "}
            MC.{" "}
            {t(
              "When you change a rule, add it here and put it into the next version of the appendix.",
            )}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4">
            {showCommissionSettings && (
              <Link href="/commission/settings" className="underline">
                {t("Commission settings")}
              </Link>
            )}
            <Link href="/leave" className="underline">
              {t("Leave settings")}
            </Link>
          </p>
        </div>
      </div>
    </LeaveSection>
  );
}
