"use client";

import { useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VisitDraft } from "@/lib/domain/site-visit-draft";
import { useT } from "@/lib/i18n/language-context";
import type { MofChoice, PipelineProject } from "./log-work-data";
import { ChoiceButton } from "./wizard-controls";

export type SiteMode = "mof" | "new";
export type Person = { id: string; name: string };

const NOT_IN_LIST = "none";
// Other supervisors' jobs are many: show the newest, and more only once they search.
const OTHER_JOBS_SHOWN = 12;
const OTHER_JOBS_SEARCHED = 40;

function MofCard({
  mof,
  on,
  onPick,
}: {
  mof: MofChoice;
  on: boolean;
  onPick: () => void;
}) {
  const t = useT();
  return (
    <ChoiceButton
      on={on}
      onClick={onPick}
      className="w-full items-start text-left"
    >
      <span className="font-mono text-base font-semibold tabular-nums">
        {mof.mofNo}
      </span>
      <span className="font-medium">{mof.projectName}</span>
      <span className="text-sm font-normal opacity-80">
        {mof.companyName}
        {mof.lastInstalled && (
          <>
            {" · "}
            <span className="font-mono tabular-nums">
              {mof.lastInstalled.pct}%
            </span>{" "}
            {t("installed")}
          </>
        )}
      </span>
    </ChoiceButton>
  );
}

function MofPicker({
  mofs,
  mofId,
  onPick,
}: {
  mofs: readonly MofChoice[];
  mofId: string | null;
  onPick: (mof: MofChoice) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const found = mofs.filter(
    (mof) =>
      needle === "" ||
      `${mof.mofNo} ${mof.projectName} ${mof.companyName}`
        .toLowerCase()
        .includes(needle),
  );
  const mine = found.filter((mof) => mof.mine);
  const others = found
    .filter((mof) => !mof.mine)
    .slice(0, needle ? OTHER_JOBS_SEARCHED : OTHER_JOBS_SHOWN);

  const group = (title: string, list: readonly MofChoice[]) =>
    list.length > 0 && (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </p>
        {list.map((mof) => (
          <MofCard
            key={mof.id}
            mof={mof}
            on={mof.id === mofId}
            onPick={() => onPick(mof)}
          />
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        aria-label={t("Search MOF no. or project name")}
        placeholder={t("Search MOF no. or project name")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-12 text-base"
      />
      {found.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("No match.")}
        </p>
      ) : (
        <>
          {group(t("My jobs"), mine)}
          {group(t("Other jobs"), others)}
        </>
      )}
    </div>
  );
}

function NewSiteForm({
  draft,
  update,
  projects,
  people,
}: {
  draft: VisitDraft;
  update: (changes: Partial<VisitDraft>) => void;
  projects: readonly PipelineProject[];
  people: readonly Person[];
}) {
  const t = useT();
  const offered = projects.filter(
    (project) => project.picId === draft.salespersonId,
  );
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="visitSalesperson">
          {t("Which salesperson asked you to go?")}
        </FieldLabel>
        <Select
          value={draft.salespersonId ?? undefined}
          onValueChange={(value) =>
            update({ salespersonId: value, projectId: null })
          }
        >
          <SelectTrigger
            id="visitSalesperson"
            className="h-12 w-full text-base"
          >
            <SelectValue placeholder={t("Choose the salesperson")} />
          </SelectTrigger>
          <SelectContent>
            {people.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="visitSite">{t("Site name / location")}</FieldLabel>
        <Input
          id="visitSite"
          value={draft.siteName}
          maxLength={200}
          placeholder={t("e.g. Menara ABC Level 12")}
          onChange={(event) => update({ siteName: event.target.value })}
          className="h-12 text-base"
        />
      </Field>
      {offered.length > 0 && (
        <Field>
          <FieldLabel htmlFor="visitProject">
            {t("Is it one of these projects? (optional)")}
          </FieldLabel>
          <Select
            value={draft.projectId ?? NOT_IN_LIST}
            onValueChange={(value) => {
              const project = offered.find((option) => option.id === value);
              update({
                projectId: project?.id ?? null,
                siteName: draft.siteName.trim() || (project?.name ?? ""),
              });
            }}
          >
            <SelectTrigger id="visitProject" className="h-12 w-full text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NOT_IN_LIST}>
                {t("Not in the list")}
              </SelectItem>
              {offered.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </div>
  );
}

/** Step 1: a job with a MOF, or a new site with no MOF yet. */
export function SiteStep({
  mode,
  onMode,
  draft,
  update,
  onPickMof,
  mofs,
  projects,
  people,
}: {
  mode: SiteMode | null;
  onMode: (mode: SiteMode) => void;
  draft: VisitDraft;
  update: (changes: Partial<VisitDraft>) => void;
  onPickMof: (mof: MofChoice) => void;
  mofs: readonly MofChoice[];
  projects: readonly PipelineProject[];
  people: readonly Person[];
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <ChoiceButton on={mode === "mof"} onClick={() => onMode("mof")}>
          <span className="font-semibold">{t("Project with MOF")}</span>
          <span className="text-sm font-normal opacity-80">
            {t("Confirmed job, has MOF number")}
          </span>
        </ChoiceButton>
        <ChoiceButton on={mode === "new"} onClick={() => onMode("new")}>
          <span className="font-semibold">{t("New site, no MOF yet")}</span>
          <span className="text-sm font-normal opacity-80">
            {t(
              "Site inspection or measurement before the project is confirmed",
            )}
          </span>
        </ChoiceButton>
      </div>
      {mode === "mof" && (
        <MofPicker mofs={mofs} mofId={draft.mofId} onPick={onPickMof} />
      )}
      {mode === "new" && (
        <NewSiteForm
          draft={draft}
          update={update}
          projects={projects}
          people={people}
        />
      )}
    </div>
  );
}
