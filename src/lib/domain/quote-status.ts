import {
  type CostingItem,
  costKeyed,
  lowestMargin,
  marginLevel,
  optionTotals,
} from "./costing";

/**
 * The approval flow of a costing revision (demo bindActions). The owner confirms a costing whose
 * weakest option meets the minimum margin, or sends a low one with a reason to the MD or Sales
 * Director, who approve it or return it with a note. Once it is OK to quote the owner records the
 * customer's option or opens a new version. The database allows an owner to confirm any revision
 * (it cannot do margin maths, loop 13 D2), so these rules are what stop a low costing skipping
 * approval.
 */

export type QuoteStatus = "draft" | "submitted" | "approved" | "returned";

export type HistoryAction =
  | "submitted"
  | "approved"
  | "returned"
  | "chosen"
  | "revised";

export type ApprovalStep = "send" | "approve" | "return" | "choose" | "revise";

/** Whether a revision can be sent at all, and if so whether its owner may confirm it alone. */
export type Readiness =
  | { ready: false; problem: string }
  | {
      ready: true;
      /** Every option meets the minimum margin and every line has its cost keyed in. */
      ownerConfirms: boolean;
      /** Some line has no cost, so the margin cannot be trusted. */
      costMissing: boolean;
    };

export function readiness(
  options: readonly { key: string; items: readonly CostingItem[] }[],
  minMarginPct: number,
): Readiness {
  if (options.length === 0) {
    return {
      ready: false,
      problem: "Add an option before sending this costing.",
    };
  }
  const empty = options.find((option) => option.items.length === 0);
  if (empty) {
    return { ready: false, problem: `Option ${empty.key} has no lines yet.` };
  }
  const items = options.flatMap((option) => option.items);
  const unpriced = items.filter((item) => !item.rate).length;
  if (unpriced > 0) {
    return {
      ready: false,
      problem: `${unpriced} ${unpriced === 1 ? "line has" : "lines have"} no price for the customer yet.`,
    };
  }
  const costMissing = !items.every(costKeyed);
  const lowest = lowestMargin(
    options.map((option) => optionTotals(option.items)),
  );
  const meets = marginLevel(lowest, minMarginPct) === "high";
  return { ready: true, ownerConfirms: meets && !costMissing, costMissing };
}

export type StepFacts = {
  status: QuoteStatus;
  /** The person owns the quote. */
  isOwner: boolean;
  /** The person is the MD or Sales Director. */
  isApprover: boolean;
  /** The revision is the quote's newest one. */
  isLatest: boolean;
  /** What the person wrote: a reason, a note, or what the action records. */
  note: string;
  readiness: Readiness;
};

export type StepOutcome =
  | {
      ok: true;
      /** The revision's new status; for "revise", the new version's. */
      status: QuoteStatus;
      history: HistoryAction;
      /** Never a margin or cost figure: notes reach people without the margin flag. */
      note: string;
    }
  | { ok: false; error: string };

export const CONFIRMED_NOTE = "Lowest margin meets the minimum. OK to quote.";

const refuse = (error: string): StepOutcome => ({ ok: false, error });
const NOT_OWNER = "Only the salesperson who owns this costing can do this.";

export function decideStep(step: ApprovalStep, facts: StepFacts): StepOutcome {
  const note = facts.note.trim();
  switch (step) {
    case "send": {
      if (!facts.isOwner) return refuse(NOT_OWNER);
      if (facts.status === "approved") {
        return refuse("This costing is already OK to quote.");
      }
      if (!facts.readiness.ready) return refuse(facts.readiness.problem);
      if (facts.readiness.ownerConfirms) {
        return {
          ok: true,
          status: "approved",
          history: "approved",
          note: CONFIRMED_NOTE,
        };
      }
      if (facts.status === "submitted") {
        return refuse(
          "It is already waiting for approval. Raise the prices to the minimum margin to confirm it yourself.",
        );
      }
      if (!note) {
        return refuse(
          "Write why this costing is below the minimum margin before sending it.",
        );
      }
      return { ok: true, status: "submitted", history: "submitted", note };
    }
    case "approve":
    case "return": {
      if (!facts.isApprover) {
        return refuse(
          "Only the MD or Sales Director approves or returns a costing.",
        );
      }
      // An approver may decide their own costing, as in the demo (loop 13 D9).
      if (facts.status !== "submitted") {
        return refuse(
          "Only a costing waiting for approval can be approved or returned.",
        );
      }
      if (step === "approve") {
        return { ok: true, status: "approved", history: "approved", note };
      }
      if (!note)
        return refuse("Write what needs changing before returning it.");
      return { ok: true, status: "returned", history: "returned", note };
    }
    case "choose": {
      if (!facts.isOwner) return refuse(NOT_OWNER);
      if (facts.status !== "approved") {
        return refuse(
          "Record the customer's option once the costing is OK to quote.",
        );
      }
      return { ok: true, status: "approved", history: "chosen", note };
    }
    case "revise": {
      if (!facts.isOwner) return refuse(NOT_OWNER);
      if (facts.status !== "approved") {
        return refuse("Open a new version from a costing that is OK to quote.");
      }
      if (!facts.isLatest) {
        return refuse("A newer version is already open. Change that one.");
      }
      return { ok: true, status: "draft", history: "revised", note };
    }
  }
}
