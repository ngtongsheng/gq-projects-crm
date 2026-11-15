"use client";

import { Input } from "@/components/ui/input";
import {
  PROBLEM_CHASED_BY,
  PROBLEM_KIND_LABEL,
  PROBLEM_OWNERS,
  type VisitDraft,
} from "@/lib/domain/site-visit-draft";
import { type CalendarDate, formatDate } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";
import { ChoiceButton, Question, YesNo } from "./wizard-controls";

export type DueOption = { label: string; on: CalendarDate };

/** "Any problem or action needed?": who follows up, what the problem is, and by when. */
export function ProblemQuestion({
  draft,
  update,
  dueOptions,
  today,
}: {
  draft: VisitDraft;
  update: (changes: Partial<VisitDraft>) => void;
  dueOptions: readonly DueOption[];
  today: CalendarDate;
}) {
  const t = useT();
  const picked = (on: CalendarDate) => draft.problemDueOn === on;
  const customDate =
    draft.problemDueOn !== null &&
    !dueOptions.some((option) => option.on === draft.problemDueOn);

  return (
    <Question
      title={t("Any problem or action needed?")}
      unanswered={draft.hasProblem === null}
    >
      <YesNo
        value={draft.hasProblem}
        onChange={(hasProblem) => update({ hasProblem })}
        yes={t("Yes, there is")}
        no={t("No problem")}
      />
      {draft.hasProblem && (
        <>
          <h4 className="text-sm font-semibold">{t("What kind?")}</h4>
          <div className="grid grid-cols-2 gap-2">
            {PROBLEM_OWNERS.map((owner) => (
              <ChoiceButton
                key={owner}
                on={draft.problemOwner === owner}
                onClick={() => update({ problemOwner: owner })}
              >
                <span className="text-sm font-semibold">
                  {t(PROBLEM_KIND_LABEL[owner])}
                </span>
                <span className="text-xs font-normal opacity-80">
                  {t(PROBLEM_CHASED_BY[owner])}
                </span>
              </ChoiceButton>
            ))}
          </div>
          <h4 className="text-sm font-semibold">
            {t("What is the problem? (one line)")}
          </h4>
          <Input
            aria-label={t("What is the problem? (one line)")}
            placeholder={t("e.g. 3 boxes missing")}
            value={draft.problemAction}
            maxLength={300}
            onChange={(event) => update({ problemAction: event.target.value })}
            className="h-12 text-base"
          />
          <h4 className="text-sm font-semibold">{t("Follow up by")}</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {dueOptions.map((option) => (
              <ChoiceButton
                key={option.on}
                on={picked(option.on)}
                onClick={() => update({ problemDueOn: option.on })}
              >
                <span className="text-sm font-semibold">{t(option.label)}</span>
                <span className="font-mono text-xs font-normal tabular-nums opacity-80">
                  {formatDate(option.on)}
                </span>
              </ChoiceButton>
            ))}
            <label
              className={cn(
                "flex min-h-12 flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2 text-sm font-semibold",
                customDate
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "bg-background",
              )}
            >
              {t("Pick a date")}
              <input
                type="date"
                min={today}
                value={customDate ? (draft.problemDueOn ?? "") : ""}
                onChange={(event) =>
                  update({ problemDueOn: event.target.value || null })
                }
                className="w-full bg-transparent text-xs font-normal"
              />
            </label>
          </div>
        </>
      )}
    </Question>
  );
}
