"use client";

import { SITE_ACTIVITY_LABEL } from "@/lib/domain/site-log";
import {
  needsMof,
  WIZARD_ACTIVITIES,
  type WizardActivity,
} from "@/lib/domain/site-visit-draft";
import { useT } from "@/lib/i18n/language-context";
import { ACTIVITY_ICON } from "../activity-icon";
import { ChoiceButton } from "./wizard-controls";

/** Step 2: tick everything done at the site. Work that needs a MOF is off for a new site. */
export function ActivityStep({
  picked,
  hasMof,
  onToggle,
}: {
  picked: readonly WizardActivity[];
  hasMof: boolean;
  onToggle: (activity: WizardActivity) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {t("Tick all that you did at this site.")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {WIZARD_ACTIVITIES.map((activity) => {
          const Icon = ACTIVITY_ICON[activity];
          const blocked = needsMof(activity) && !hasMof;
          return (
            <ChoiceButton
              key={activity}
              on={picked.includes(activity)}
              disabled={blocked}
              onClick={() => onToggle(activity)}
              className="min-h-20"
            >
              <Icon aria-hidden className="size-6" />
              <span className="font-semibold">
                {t(SITE_ACTIVITY_LABEL[activity])}
              </span>
              {blocked && (
                <span className="text-xs font-normal">{t("Needs MOF")}</span>
              )}
            </ChoiceButton>
          );
        })}
      </div>
    </div>
  );
}
