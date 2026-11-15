import {
  emptyDraft,
  needsMof,
  type VisitDraft,
  WIZARD_ACTIVITIES,
  type WizardActivity,
} from "@/lib/domain/site-visit-draft";
import { isOneOf } from "@/lib/form/one-of";
import type { MofChoice, PipelineProject } from "./log-work-data";
import type { SiteMode } from "./site-step";

/** What the address already says: the site and activity a planned job or missed day carries. */
export type WizardPreset = {
  mofId: string | null;
  projectId: string | null;
  siteName: string | null;
  activity: string | null;
};

export type WizardStart = {
  step: 1 | 2;
  mode: SiteMode | null;
  draft: VisitDraft;
};

/**
 * Where the wizard opens. A known job skips the "which site" step; a new site does too once its
 * name and salesperson are known. Anything the address names that no longer exists is ignored.
 */
export function wizardStart(
  preset: WizardPreset,
  mofs: readonly MofChoice[],
  projects: readonly PipelineProject[],
): WizardStart {
  const draft = emptyDraft();
  const mof = mofs.find((choice) => choice.id === preset.mofId);
  const project = projects.find((choice) => choice.id === preset.projectId);

  let mode: SiteMode | null = null;
  let known = false;
  if (mof) {
    mode = "mof";
    draft.mofId = mof.id;
    known = true;
  } else if (project) {
    mode = "new";
    draft.projectId = project.id;
    draft.salespersonId = project.picId;
    draft.siteName = preset.siteName?.trim() || project.name;
    known = true;
  } else if (preset.siteName?.trim()) {
    mode = "new";
    draft.siteName = preset.siteName.trim();
  }

  const activity = preset.activity;
  if (
    known &&
    activity !== null &&
    isOneOf(WIZARD_ACTIVITIES, activity) &&
    (mof !== undefined || !needsMof(activity))
  ) {
    draft.activities = [activity satisfies WizardActivity];
  }
  return { step: known ? 2 : 1, mode, draft };
}
