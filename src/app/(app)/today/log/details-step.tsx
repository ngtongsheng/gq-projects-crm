"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isLowerThanLastInstalled } from "@/lib/domain/site-log";
import {
  asksBalanceStock,
  type VisitDraft,
} from "@/lib/domain/site-visit-draft";
import { formatDate } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { BalanceStockQuestion } from "./balance-stock-question";
import type { MofChoice } from "./log-work-data";
import { type DueOption, ProblemQuestion } from "./problem-question";
import { ChoiceButton, Question, YesNo } from "./wizard-controls";

const INSTALLED_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function InstalledQuestion({
  draft,
  update,
  last,
}: {
  draft: VisitDraft;
  update: (changes: Partial<VisitDraft>) => void;
  last: MofChoice["lastInstalled"];
}) {
  const t = useT();
  return (
    <Question
      title={t("How much of the whole job is installed now?")}
      hint={
        last
          ? `${t("Last time")}: ${last.pct}% · ${formatDate(last.on)}`
          : t("First time for this MOF")
      }
      unanswered={draft.installedPct === null}
    >
      {draft.installedPct !== null &&
        isLowerThanLastInstalled(draft.installedPct, last?.pct ?? null) && (
          <p className="text-sm font-medium text-warn">
            {t("Lower than last time. Check again.")}
          </p>
        )}
      <div className="grid grid-cols-5 gap-2">
        {INSTALLED_STEPS.map((pct) => (
          <ChoiceButton
            key={pct}
            on={draft.installedPct === pct}
            onClick={() => update({ installedPct: pct })}
            className="items-center px-1 text-center font-mono tabular-nums"
          >
            {pct}%
          </ChoiceButton>
        ))}
      </div>
    </Question>
  );
}

/** Step 3: one question per ticked activity, then balance stock, any problem and a short note. */
export function DetailsStep({
  draft,
  update,
  lastInstalled,
  salespersonName,
  dueOptions,
  today,
}: {
  draft: VisitDraft;
  update: (changes: Partial<VisitDraft>) => void;
  lastInstalled: MofChoice["lastInstalled"];
  salespersonName: string | null;
  dueOptions: readonly DueOption[];
  today: string;
}) {
  const t = useT();
  const did = (activity: VisitDraft["activities"][number]) =>
    draft.activities.includes(activity);

  return (
    <div className="flex flex-col gap-4">
      {did("installation") && (
        <InstalledQuestion draft={draft} update={update} last={lastInstalled} />
      )}
      {did("measurement") && (
        <Question
          title={`${t("Sent to")} ${salespersonName ?? t("Salesperson")}?`}
          unanswered={draft.measurementSent === null}
        >
          <YesNo
            value={draft.measurementSent}
            onChange={(measurementSent) => update({ measurementSent })}
            yes={t("Yes")}
            no={t("Not yet")}
          />
        </Question>
      )}
      {did("shooting") && (
        <Question
          title={t("Photos / video posted in the job site WhatsApp group?")}
          hint={t(
            "Take many photos. Sales support saves them to Google Drive.",
          )}
          unanswered={draft.photosPosted === null}
        >
          <YesNo
            value={draft.photosPosted}
            onChange={(photosPosted) => update({ photosPosted })}
            yes={t("Yes")}
            no={t("Not yet")}
          />
        </Question>
      )}
      {did("delivery") && (
        <Question
          title={t("Delivery OK?")}
          unanswered={draft.deliveryOk === null}
        >
          <YesNo
            value={draft.deliveryOk}
            onChange={(deliveryOk) =>
              // A delivery with a problem is one to follow up: open the question for them.
              update(
                deliveryOk
                  ? { deliveryOk }
                  : {
                      deliveryOk,
                      hasProblem: true,
                      problemOwner: draft.problemOwner ?? "purchasing",
                    },
              )
            }
            yes={t("All OK")}
            no={t("Problem")}
          />
        </Question>
      )}
      {did("handover") && (
        <>
          <Question
            title={t("Handover form signed?")}
            unanswered={draft.handoverSigned === null}
          >
            <YesNo
              value={draft.handoverSigned}
              onChange={(handoverSigned) => update({ handoverSigned })}
              yes={t("Yes")}
              no={t("Not yet")}
            />
          </Question>
          <Question
            title={t(
              "At least 4 completed photos posted in the job site WhatsApp group?",
            )}
            hint={t(
              "Clean site, lights on, phone landscape: 2 wide shots, 1 close-up, 1 detail (edging / skirting).",
            )}
            unanswered={draft.completedPhotosPosted === null}
          >
            <YesNo
              value={draft.completedPhotosPosted}
              onChange={(completedPhotosPosted) =>
                update({ completedPhotosPosted })
              }
              yes={t("Yes")}
              no={t("Not yet")}
            />
          </Question>
        </>
      )}
      {asksBalanceStock(draft) && (
        <BalanceStockQuestion
          draft={draft}
          update={update}
          isStockReturn={did("stock_return")}
        />
      )}
      <ProblemQuestion
        draft={draft}
        update={update}
        dueOptions={dueOptions}
        today={today}
      />
      <Field>
        <FieldLabel htmlFor="visitNote">
          {t("Short note (optional)")}
        </FieldLabel>
        <Input
          id="visitNote"
          value={draft.note}
          maxLength={1000}
          placeholder={t("e.g. Level 3 done, Level 4 tomorrow")}
          onChange={(event) => update({ note: event.target.value })}
          className="h-12 text-base"
        />
      </Field>
    </div>
  );
}
