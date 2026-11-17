import type { JobRole } from "@/lib/auth/job-role";
import { claimPeriod } from "@/lib/domain/claim-month";
import {
  type CalendarDate,
  daysBetween,
  formatDate,
  formatMonth,
} from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import type { TravelClaimStatus } from "../claims/travel-claim-data";
import { isCustomSampleSeller } from "../custom-samples/custom-sample-access";
import {
  customSampleStatus,
  daysOverdue,
  openLoan,
} from "../custom-samples/custom-sample-status";
import type { CustomSample } from "../custom-samples/custom-sample-types";
import type { PrepaidAccount } from "../marketing/marketing-types";

export type Reminder = {
  key: string;
  tone: "bad" | "warn" | "info";
  /** How many things the line stands for, shown in the badge. */
  count: number;
  text: string;
  href: string;
};

/** A claim is chased from this many days before its cut-off (demo weeklyItems). */
const CLAIM_REMINDER_DAYS = 10;
/** A lent sample is chased from this many days before it is due. */
const SAMPLE_REMINDER_DAYS = 3;

type Person = { jobRole: JobRole; sells: boolean };

/** The kinds of reminder a person can have, so the dashboard loads only what it will show. */
export function reminderPlan(person: Person & { canFileClaim: boolean }) {
  const settles = person.jobRole === "accounts" || person.jobRole === "md";
  const officeSamples = ["designer", "ssup", "md"].includes(person.jobRole);
  return {
    travelClaim: person.canFileClaim,
    readyToRelease: settles,
    prepaidLow: settles,
    borrowedSamples: isCustomSampleSeller(person),
    officeSamples,
  };
}

/** "Nov travel claim not submitted" once the cut-off is within 10 days and the claim is missing or still a draft. */
export function travelClaimReminder(
  facts: {
    today: CalendarDate;
    cutOffDay: number;
    /** The claim for today's claim month; null when none was started. */
    claim: { status: TravelClaimStatus } | null;
    month: CalendarDate;
  },
  t: Translate,
): Reminder[] {
  if (facts.claim && facts.claim.status !== "draft") return [];
  const cutOff = claimPeriod(facts.month, facts.cutOffDay).to;
  if (daysBetween(facts.today, cutOff) > CLAIM_REMINDER_DAYS) return [];
  return [
    {
      key: "travelClaimDue",
      tone: "warn",
      count: 1,
      text: `${formatMonth(facts.month)} ${t("travel claim not submitted – cut-off")} ${formatDate(cutOff)}. ${t("Print it and attach the receipts.")}`,
      href: "/claims",
    },
  ];
}

export function claimsReadyReminder(count: number, t: Translate): Reminder[] {
  if (count <= 0) return [];
  return [
    {
      key: "travelClaimsToRelease",
      tone: "info",
      count,
      text: `${count} ${t(count === 1 ? "travel claim" : "travel claims")} ${t("ready to release (monthly report submitted)")}`,
      href: "/claims?view=all",
    },
  ];
}

/** One line for each sample the person holds that is due within 3 days or overdue; one they marked returned drops off. */
export function borrowedSampleReminders(
  facts: {
    today: CalendarDate;
    personId: string;
    samples: readonly CustomSample[];
  },
  t: Translate,
): Reminder[] {
  return facts.samples.flatMap((sample) => {
    const loan = openLoan(sample);
    if (
      sample.givenOn !== null ||
      !loan ||
      loan.salespersonId !== facts.personId ||
      loan.returnedMarkedOn !== null ||
      daysBetween(facts.today, loan.dueOn) > SAMPLE_REMINDER_DAYS
    ) {
      return [];
    }
    const overdue = loan.dueOn < facts.today;
    const when = overdue
      ? `${t("overdue since")} ${formatDate(loan.dueOn)}`
      : `${t("due")} ${formatDate(loan.dueOn)}`;
    return [
      {
        key: `sampleDue-${sample.id}`,
        tone: overdue ? "bad" : "warn",
        count: 1,
        text: `${t("Return custom sample")} ${sample.code} ${sample.designName} (${loan.customer}) – ${when}`,
        href: "/custom-samples",
      },
    ];
  });
}

/** For the designer, Senior Support and MD: returns to confirm, and samples overdue. */
export function officeSampleReminders(
  facts: {
    today: CalendarDate;
    samples: readonly CustomSample[];
    nameOf: (personId: string) => string;
  },
  t: Translate,
): Reminder[] {
  const holder = (sample: CustomSample) =>
    `${sample.code} (${facts.nameOf(openLoan(sample)?.salespersonId ?? "")})`;
  const toConfirm = facts.samples.filter(
    (sample) => customSampleStatus(sample) === "to-confirm",
  );
  const overdue = facts.samples.filter(
    (sample) => daysOverdue(sample, facts.today) > 0,
  );
  const lines: Reminder[] = [];
  if (toConfirm.length > 0) {
    lines.push({
      key: "customSamplesToConfirm",
      tone: "info",
      count: toConfirm.length,
      text: `${t(toConfirm.length === 1 ? "Confirm custom sample received back" : "Confirm custom samples received back")}: ${toConfirm.map(holder).join(", ")}`,
      href: "/custom-samples",
    });
  }
  if (overdue.length > 0) {
    lines.push({
      key: "customSamplesOverdue",
      tone: "bad",
      count: overdue.length,
      text: `${overdue.length} ${t(overdue.length === 1 ? "custom sample overdue – WhatsApp to return" : "custom samples overdue – WhatsApp to return")}: ${overdue.map(holder).join(", ")}`,
      href: "/custom-samples",
    });
  }
  return lines;
}

/** For HR & Accounts and the MD: the vendors whose prepaid balance fell below their alert. */
export function prepaidLowReminder(
  accounts: readonly PrepaidAccount[],
  t: Translate,
): Reminder[] {
  const low = accounts.filter((account) => account.low);
  if (low.length === 0) return [];
  return [
    {
      key: "prepaidLow",
      tone: "warn",
      count: low.length,
      text: `${t("Prepaid balance low – top up")}: ${low.map((account) => `${account.vendorName} ${formatRm(account.balance)}`).join(", ")}`,
      href:
        low.length === 1
          ? `/marketing?view=prepaid&vendor=${low[0].vendorId}`
          : "/marketing?view=prepaid",
    },
  ];
}
