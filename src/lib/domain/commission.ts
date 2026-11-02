import type { CommissionMode } from "@/lib/auth/job-role";
import { type CalendarDate, daysBetween, formatDate } from "@/lib/format/date";
import { formatRm, fromCents, toCents } from "@/lib/format/money";
import { summariseCollection } from "./collection";
import type { CommissionSettings } from "./commission-settings";

export type CommissionType = "own" | "pass_down" | "company";

const TYPE_LABEL: Record<CommissionType, string> = {
  own: "Own effort",
  pass_down: "Pass-down",
  company: "Company account",
};

export type MarginTier = "unknown" | "none" | "low" | "standard" | "high";

export type CommissionPerson = {
  id: string;
  name: string;
  commissionMode: CommissionMode;
};

export type CommissionInput = {
  mof: {
    /** Contract sum plus VOs. */
    total: number;
    commissionType: CommissionType;
    /** Late collection counts from the invoice date, or the LOA date until there is one. */
    invoiceDate: CalendarDate | null;
    loaDate: CalendarDate;
    salespersonId: string;
    secondSalespersonId: string | null;
    /** Who passed the customer down (from the project), if anyone. */
    passedById: string | null;
  };
  /** Null when the cost is not keyed in, or the caller may not see it. */
  cost: number | null;
  payments: readonly { amount: number; receivedOn: CalendarDate }[];
  people: readonly CommissionPerson[];
  settings: CommissionSettings;
  today: CalendarDate;
};

export type PersonCommission = {
  personId: string;
  name: string;
  ratePct: number;
  sharePct: number;
  /** What the person gets once the MOF is paid in full, on time. */
  full: number;
  /** Commission on the money received so far, after late cuts. */
  earned: number;
  /** Taken off `earned` for money received late. */
  lateCut: number;
  claimable: boolean;
  lines: string[];
};

export type CommissionResult = {
  /** Rounded to 0.1; null without a cost. */
  marginPct: number | null;
  tier: MarginTier;
  pctPaid: number;
  claimable: boolean;
  people: PersonCommission[];
  lines: string[];
};

const pct = (value: number) => `${Number(value.toFixed(2))}%`;

// toPrecision(12) drops binary noise (0.03 x 0.5 is not exact) before rounding to a cent.
const roundCents = (cents: number) => Math.round(Number(cents.toPrecision(12)));

/** Rough commission shown on the pipeline: project value times the base rate for its type. */
export function estimatedCommission(
  value: number,
  commissionType: CommissionType,
  settings: CommissionSettings,
): number {
  return fromCents(
    Math.round((toCents(value) * settings.baseRatePct[commissionType]) / 100),
  );
}

// Compares margin to a percentage on whole numbers: (invoice - cost) / invoice vs pct / 100.
function marginTier(
  invoiceCents: number,
  costCents: number | null,
  s: CommissionSettings,
): MarginTier {
  if (costCents === null) return "unknown";
  const marginTimes10k = (invoiceCents - costCents) * 10_000;
  const level = (p: number) => Math.round(p * 100) * invoiceCents;
  if (marginTimes10k < level(s.noCommissionBelowPct)) return "none";
  if (marginTimes10k < level(s.lowMarginBelowPct)) return "low";
  if (marginTimes10k > level(s.highMarginAbovePct)) return "high";
  return "standard";
}

function lateCutPct(days: number, s: CommissionSettings): number {
  if (days > s.secondLateCut.afterDays) return s.secondLateCut.cutPct;
  if (days > s.firstLateCut.afterDays) return s.firstLateCut.cutPct;
  return 0;
}

type Share = {
  person: CommissionPerson;
  sharePct: number;
  /** Rate before the margin rule. */
  baseRatePct: number;
  label: string;
};

function shares(input: CommissionInput): {
  shares: Share[];
  lines: string[];
} {
  const { mof, people, settings: s } = input;
  const byId = new Map(people.map((person) => [person.id, person]));
  const find = (id: string): CommissionPerson =>
    byId.get(id) ?? { id, name: "Unnamed", commissionMode: "standard" };
  const owners = [mof.salespersonId, mof.secondSalespersonId]
    .filter((id): id is string => id !== null)
    .map(find);
  const lines: string[] = [];
  const result: Share[] = [];

  owners.forEach((person, index) => {
    const sharePct =
      owners.length === 1
        ? 100
        : index === 0
          ? s.splitSharePct
          : 100 - s.splitSharePct;
    if (person.commissionMode === "excluded") {
      lines.push(`${person.name} has no commission (person setting).`);
      return;
    }
    const flat = person.commissionMode === "flat_pass_down";
    result.push({
      person,
      sharePct,
      baseRatePct: flat
        ? s.flatPassDownRatePct
        : s.baseRatePct[mof.commissionType],
      label: flat
        ? `Flat ${pct(s.flatPassDownRatePct)}`
        : `${TYPE_LABEL[mof.commissionType]} ${pct(s.baseRatePct[mof.commissionType])}`,
    });
  });

  // The person who passed the customer down keeps their flat rate on the whole sale.
  const passer = mof.passedById ? find(mof.passedById) : null;
  if (
    passer &&
    mof.commissionType === "pass_down" &&
    passer.commissionMode === "flat_pass_down" &&
    !owners.some((owner) => owner.id === passer.id)
  ) {
    result.push({
      person: passer,
      sharePct: 100,
      baseRatePct: s.flatPassDownRatePct,
      label: `Passed down: flat ${pct(s.flatPassDownRatePct)}`,
    });
  }
  return { shares: result, lines };
}

function marginRate(
  share: Share,
  tier: MarginTier,
  type: CommissionType,
  s: CommissionSettings,
): { ratePct: number; note: string | null } {
  const flat = share.person.commissionMode === "flat_pass_down";
  const base = share.baseRatePct;
  if (tier === "none") {
    return { ratePct: 0, note: "No commission: margin too low." };
  }
  if (tier === "low") {
    const cap = flat
      ? s.flatPassDownRatePct
      : type === "own"
        ? s.lowMarginRatePct.own
        : s.lowMarginRatePct.other;
    const ratePct = Math.min(base, cap);
    return {
      ratePct,
      note:
        ratePct === base
          ? null
          : `Low margin: ${pct(ratePct)} (was ${pct(base)}).`,
    };
  }
  if (tier === "high" && !flat) {
    const ratePct = base + s.highMarginBonusPct;
    return {
      ratePct,
      note: `High margin: +${pct(s.highMarginBonusPct)} extra.`,
    };
  }
  return { ratePct: base, note: null };
}

function tierLine(
  tier: MarginTier,
  marginPct: number | null,
  s: CommissionSettings,
): string {
  const margin = marginPct === null ? "" : pct(marginPct);
  switch (tier) {
    case "unknown":
      return "Cost not keyed in: the margin rule can't be applied, so this can't be claimed yet.";
    case "none":
      return `Margin ${margin} is below ${pct(s.noCommissionBelowPct)}: no commission.`;
    case "low":
      return `Margin ${margin} is below ${pct(s.lowMarginBelowPct)}: low-margin rate.`;
    case "high":
      return `Margin ${margin} is above ${pct(s.highMarginAbovePct)}: +${pct(s.highMarginBonusPct)} extra.`;
    case "standard":
      return `Margin ${margin}: standard rate.`;
  }
}

/**
 * Commission on one MOF, per person. Commission is paid on money received: each payment earns
 * total x rate x share, less the late cut for its days after the invoice date. Money beyond the
 * order total earns nothing. All money is summed in cents and rounded once per person.
 */
export function calculateCommission(input: CommissionInput): CommissionResult {
  const { mof, settings: s } = input;
  const invoiceCents = toCents(mof.total);
  const costCents = input.cost === null ? null : toCents(input.cost);
  const tier = marginTier(invoiceCents, costCents, s);
  const marginPct =
    costCents === null
      ? null
      : Math.round(((invoiceCents - costCents) * 1000) / invoiceCents) / 10;
  const collection = summariseCollection(
    mof.total,
    input.payments.map((payment) => payment.amount),
    s.claimThresholdPct,
  );
  const thresholdMet =
    collection.state === "fully_paid" || collection.state === "commission_open";
  const lateFrom = mof.invoiceDate ?? mof.loaDate;

  // Payments in date order, each counted only up to what is still owed.
  let owedCents = invoiceCents;
  const counted = [...input.payments]
    .sort((a, b) => a.receivedOn.localeCompare(b.receivedOn))
    .map((payment) => {
      const cents = Math.min(toCents(payment.amount), Math.max(0, owedCents));
      owedCents -= cents;
      const days = daysBetween(lateFrom, payment.receivedOn);
      return { ...payment, cents, days, cutPct: lateCutPct(days, s) };
    });

  const split = shares(input);
  const people = split.shares.map((share): PersonCommission => {
    const { ratePct, note } = marginRate(share, tier, mof.commissionType, s);
    const factor = (ratePct / 100) * (share.sharePct / 100);
    const lines = [
      share.sharePct === 100
        ? share.label
        : `${share.label} x ${pct(share.sharePct)} share`,
    ];
    if (note) lines.push(note);

    let grossCents = 0;
    let cutCents = 0;
    for (const payment of counted) {
      const commission = payment.cents * factor;
      grossCents += commission;
      if (payment.cutPct > 0 && commission > 0) {
        const cut = (commission * payment.cutPct) / 100;
        cutCents += cut;
        lines.push(
          `${formatRm(fromCents(payment.cents))} received ${formatDate(payment.receivedOn)}, ${payment.days} days after the invoice: cut ${pct(payment.cutPct)} (-${formatRm(fromCents(roundCents(cut)))}).`,
        );
      }
    }
    const lateCut = roundCents(cutCents);
    const earned = roundCents(grossCents) - lateCut;
    return {
      personId: share.person.id,
      name: share.person.name,
      ratePct,
      sharePct: share.sharePct,
      full: fromCents(roundCents(invoiceCents * factor)),
      earned: fromCents(earned),
      lateCut: fromCents(lateCut),
      claimable: thresholdMet && tier !== "unknown" && earned > 0,
      lines,
    };
  });

  const lines = [tierLine(tier, marginPct, s), ...split.lines];
  if (!thresholdMet) {
    lines.push(
      `${collection.pctPaid}% paid: claimable from ${pct(s.claimThresholdPct)}.`,
    );
  }
  if (collection.state !== "fully_paid") {
    const days = daysBetween(lateFrom, input.today);
    const cutNow = lateCutPct(days, s);
    lines.push(
      cutNow > 0
        ? `${days} days since the invoice: money received from now on is cut ${pct(cutNow)}.`
        : `Money received more than ${s.firstLateCut.afterDays} days after the invoice is cut ${pct(s.firstLateCut.cutPct)} (${s.firstLateCut.afterDays - days} days left).`,
    );
  }

  return {
    marginPct,
    tier,
    pctPaid: collection.pctPaid,
    claimable: people.some((person) => person.claimable),
    people,
    lines,
  };
}
