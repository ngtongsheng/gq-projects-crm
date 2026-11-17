import type { Profile } from "@/lib/auth/current-profile";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { canFileClaim } from "@/lib/domain/claim-eligibility";
import { claimMonthOf } from "@/lib/domain/claim-month";
import type { CalendarDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { loadClaimSettings } from "../claims/claim-settings-data";
import { countClaimsReadyToRelease } from "../claims/ready-to-release-data";
import { loadTravelClaim } from "../claims/travel-claim-data";
import { loadCustomSamples } from "../custom-samples/custom-samples-data";
import { loadPrepaidAccounts } from "../marketing/marketing-prepaid-data";
import {
  borrowedSampleReminders,
  claimsReadyReminder,
  officeSampleReminders,
  prepaidLowReminder,
  type Reminder,
  reminderPlan,
  travelClaimReminder,
} from "./home-reminders";

/** What this person should be reminded of today, loading only what their role acts on. */
export async function loadHomeReminders(
  me: Profile,
  today: CalendarDate,
  t: Translate,
): Promise<Reminder[]> {
  const plan = reminderPlan({ ...me, canFileClaim: canFileClaim(me) });
  const wantsSamples = plan.borrowedSamples || plan.officeSamples;
  const [claimLines, readyCount, samples, names, prepaid] = await Promise.all([
    plan.travelClaim ? loadOwnClaimReminder(me, today, t) : [],
    plan.readyToRelease ? countClaimsReadyToRelease() : 0,
    wantsSamples ? loadCustomSamples({ withPhotos: false }) : [],
    plan.officeSamples ? getTeamDirectory() : [],
    plan.prepaidLow ? loadPrepaidAccounts() : [],
  ]);
  const nameOf = new Map(names.map((member) => [member.id, member.name]));
  return [
    ...claimLines,
    ...(plan.borrowedSamples
      ? borrowedSampleReminders({ today, personId: me.id, samples }, t)
      : []),
    ...(plan.officeSamples
      ? officeSampleReminders(
          { today, samples, nameOf: (id) => nameOf.get(id) ?? t("Unnamed") },
          t,
        )
      : []),
    ...claimsReadyReminder(readyCount, t),
    ...prepaidLowReminder(prepaid, t),
  ];
}

async function loadOwnClaimReminder(
  me: Profile,
  today: CalendarDate,
  t: Translate,
): Promise<Reminder[]> {
  const { cutOffDay } = await loadClaimSettings();
  const month = claimMonthOf(today, cutOffDay);
  const claim = await loadTravelClaim(me.id, month);
  return travelClaimReminder({ today, cutOffDay, claim, month }, t);
}
