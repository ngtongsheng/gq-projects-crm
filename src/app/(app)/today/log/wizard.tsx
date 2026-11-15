"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  countSiteVisits,
  type LoggedSite,
  SITE_ACTIVITY_LABEL,
  stockReturnWhatsAppText,
  VISIT_SAVED_BUT,
  whatsAppLink,
} from "@/lib/domain/site-log";
import {
  balanceStockItems,
  detailsProblem,
  emptyDraft,
  listsBalanceStock,
  type VisitDraft,
  visitInput,
  type WizardActivity,
} from "@/lib/domain/site-visit-draft";
import { type CalendarDate, formatDate } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { saveSiteVisit } from "../../site-work/actions";
import { ActivityStep } from "./activity-step";
import { DetailsStep } from "./details-step";
import type { MofChoice, PipelineProject } from "./log-work-data";
import type { DueOption } from "./problem-question";
import { SavedStep, type SavedVisit } from "./saved-step";
import { type Person, type SiteMode, SiteStep } from "./site-step";
import { WizardNav } from "./wizard-nav";
import { type WizardPreset, wizardStart } from "./wizard-start";

type Step = 1 | 2 | 3 | 4;

export type LogWorkWizardProps = {
  day: CalendarDate;
  today: CalendarDate;
  supervisorName: string;
  mofs: MofChoice[];
  projects: PipelineProject[];
  people: Person[];
  dueOptions: DueOption[];
  /** The month's visits already logged, so the saved page can show the new count. */
  monthLogs: LoggedSite[];
  visitTarget: number;
  preset: WizardPreset;
};

/** The Log work wizard (demo: lwWizard): which site, what was done, what happened, saved. */
export function LogWorkWizard(props: LogWorkWizardProps) {
  const { day, today, mofs, projects, people, dueOptions } = props;
  const t = useT();
  const [start] = useState(() => wizardStart(props.preset, mofs, projects));
  const [step, setStep] = useState<Step>(start.step);
  const [mode, setMode] = useState<SiteMode | null>(start.mode);
  const [draft, setDraft] = useState<VisitDraft>(() => ({
    ...start.draft,
    problemDueOn: dueOptions[1]?.on ?? null,
  }));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedVisit | null>(null);
  const [logged, setLogged] = useState(props.monthLogs);
  const [pending, startTransition] = useTransition();

  // A new step opens at the top, not wherever the last one was scrolled to.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the step changes
  useEffect(() => window.scrollTo(0, 0), [step]);

  const mof = mofs.find((choice) => choice.id === draft.mofId) ?? null;
  const siteLabel = mof ? `${mof.mofNo} · ${mof.projectName}` : draft.siteName;
  const salespersonId = mof?.salespersonId ?? draft.salespersonId;
  const salespersonName =
    people.find((person) => person.id === salespersonId)?.name ?? null;
  const doneHref = day === today ? "/today" : `/today?date=${day}`;

  const update = (changes: Partial<VisitDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setError(null);
  };
  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };

  function chooseMode(next: SiteMode) {
    if (next === mode) return;
    setMode(next);
    update({
      mofId: null,
      siteName: "",
      salespersonId: null,
      projectId: null,
      activities: [],
    });
  }

  function toggleActivity(activity: WizardActivity) {
    update({
      activities: draft.activities.includes(activity)
        ? draft.activities.filter((picked) => picked !== activity)
        : [...draft.activities, activity],
    });
  }

  function save() {
    const problem = detailsProblem(draft);
    if (problem) {
      setError(t(problem));
      return;
    }
    startTransition(async () => {
      const result = await saveSiteVisit(visitInput(draft, day));
      // Saved but a later step failed: do not let them save the same visit twice.
      const partly = result.error?.startsWith(VISIT_SAVED_BUT) ?? false;
      if (result.error && !partly) {
        setError(result.error);
        return;
      }
      if (partly && result.error) toast.warning(result.error);

      const here: LoggedSite = {
        visitedOn: day,
        mofId: draft.mofId,
        siteName: mof ? null : draft.siteName.trim(),
      };
      const items = balanceStockItems(draft);
      const text =
        mof && draft.returnWay && listsBalanceStock(draft) && items.length > 0
          ? stockReturnWhatsAppText({
              sentBack: draft.activities.includes("stock_return"),
              mofNo: mof.mofNo,
              siteName: mof.projectName,
              items,
              way: draft.returnWay,
              supervisorName: props.supervisorName,
              on: day,
            })
          : null;
      setLogged((current) => [...current, here]);
      setSaved({
        siteLabel,
        monthVisits: countSiteVisits([...logged, here], day),
        movedTo: result.movedTo,
        stockReturn: text
          ? {
              text,
              // The office number is not a setting yet, so they pick the chat themselves.
              href: whatsAppLink(null, text),
              isReturn: draft.activities.includes("stock_return"),
            }
          : null,
      });
      go(4);
    });
  }

  function next() {
    if (step === 1) {
      if (mode === null) return setError(t("Choose a site first."));
      if (mode === "mof") {
        return draft.mofId ? go(2) : setError(t("Choose a site first."));
      }
      if (!draft.siteName.trim() || !draft.salespersonId) {
        return setError(t("Type the site name and choose the salesperson."));
      }
      return go(2);
    }
    if (step === 2) {
      if (draft.activities.length === 0)
        return setError(t("Tick at least one."));
      return go(3);
    }
    save();
  }

  function another() {
    setDraft({ ...emptyDraft(), problemDueOn: dueOptions[1]?.on ?? null });
    setMode(null);
    setSaved(null);
    go(1);
  }

  const titles: Record<1 | 2 | 3, string> = {
    1: t("Which site?"),
    2: t("What did you do?"),
    3: siteLabel,
  };

  return (
    <div className="flex flex-col gap-4 pb-28 md:pb-0">
      {step !== 4 && (
        <div>
          <p className="text-sm text-muted-foreground">
            {t("Step")} {step} {t("of")} 3 · {formatDate(day)}
          </p>
          <h2 className="font-heading text-xl font-semibold">{titles[step]}</h2>
        </div>
      )}
      {(step === 2 || step === 3) && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {step === 2 ? t("Site") : t("Activities")}:
          <span className="font-semibold">
            {step === 2
              ? siteLabel
              : draft.activities
                  .map((activity) => t(SITE_ACTIVITY_LABEL[activity]))
                  .join(", ")}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => go(step === 2 ? 1 : 2)}
          >
            {t("Change")}
          </Button>
        </p>
      )}
      {step === 1 && (
        <SiteStep
          mode={mode}
          onMode={chooseMode}
          draft={draft}
          update={update}
          onPickMof={(choice) => {
            update({ mofId: choice.id });
            go(2);
          }}
          mofs={mofs}
          projects={projects}
          people={people}
        />
      )}
      {step === 2 && (
        <ActivityStep
          picked={draft.activities}
          hasMof={mof !== null}
          onToggle={toggleActivity}
        />
      )}
      {step === 3 && (
        <DetailsStep
          draft={draft}
          update={update}
          lastInstalled={mof?.lastInstalled ?? null}
          salespersonName={salespersonName}
          dueOptions={dueOptions}
          today={today}
        />
      )}
      {step === 4 && saved && (
        <SavedStep
          saved={saved}
          target={props.visitTarget}
          doneHref={doneHref}
          onAnother={another}
        />
      )}
      {step < 4 && (
        <WizardNav
          error={error}
          pending={pending}
          nextLabel={
            step === 3 ? (pending ? t("Saving...") : t("Save")) : t("Next")
          }
          onNext={next}
          onBack={step === 1 ? null : () => go(step === 2 ? 1 : 2)}
          cancelHref={doneHref}
        />
      )}
    </div>
  );
}
