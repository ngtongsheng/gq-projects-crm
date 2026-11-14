import { describe, expect, it } from "vitest";
import type { CostingItem } from "./costing";
import {
  type ApprovalStep,
  CONFIRMED_NOTE,
  decideStep,
  type QuoteStatus,
  type Readiness,
  readiness,
  type StepFacts,
} from "./quote-status";

// Sell 100, cost 60: 40% margin.
const healthy: CostingItem = { type: "lump", qty: 1, rate: 100, cost: 60 };
// Sell 100, cost 80: 20% margin.
const thin: CostingItem = { type: "lump", qty: 1, rate: 100, cost: 80 };
// Keyed by someone without the margin flag: sells, but no cost.
const noCost: CostingItem = { type: "lump", qty: 1, rate: 100, cost: null };
const discount: CostingItem = { type: "discount", rate: 5 };

describe("readiness", () => {
  it("lets the owner confirm when every option meets the minimum and every cost is keyed", () => {
    expect(
      readiness(
        [
          { key: "A", items: [healthy, discount] },
          { key: "B", items: [healthy] },
        ],
        30,
      ),
    ).toEqual({ ready: true, ownerConfirms: true, costMissing: false });
  });

  it("needs approval when the weakest option is below the minimum", () => {
    expect(
      readiness(
        [
          { key: "A", items: [healthy] },
          { key: "B", items: [thin] },
        ],
        30,
      ),
    ).toEqual({ ready: true, ownerConfirms: false, costMissing: false });
  });

  it("treats exactly the minimum as meeting it", () => {
    const thirty: CostingItem = { type: "lump", qty: 1, rate: 100, cost: 70 };
    expect(readiness([{ key: "A", items: [thirty] }], 30)).toMatchObject({
      ownerConfirms: true,
    });
  });

  it("needs approval when a line has no cost, though the margin reads high", () => {
    expect(readiness([{ key: "A", items: [healthy, noCost] }], 30)).toEqual({
      ready: true,
      ownerConfirms: false,
      costMissing: true,
    });
  });

  it("refuses a revision with no options, an empty option or an unpriced line", () => {
    expect(readiness([], 30)).toMatchObject({ ready: false });
    expect(
      readiness(
        [
          { key: "A", items: [healthy] },
          { key: "B", items: [] },
        ],
        30,
      ),
    ).toEqual({ ready: false, problem: "Option B has no lines yet." });
    expect(
      readiness(
        [
          {
            key: "A",
            items: [
              healthy,
              { ...healthy, rate: 0 },
              { ...healthy, rate: null },
            ],
          },
        ],
        30,
      ),
    ).toEqual({
      ready: false,
      problem: "2 lines have no price for the customer yet.",
    });
  });
});

const confirms: Readiness = {
  ready: true,
  ownerConfirms: true,
  costMissing: false,
};
const low: Readiness = {
  ready: true,
  ownerConfirms: false,
  costMissing: false,
};

const owner = { isOwner: true, isApprover: false };
const approver = { isOwner: false, isApprover: true };
const approverOwner = { isOwner: true, isApprover: true };
const bystander = { isOwner: false, isApprover: false };

const facts = (overrides: Partial<StepFacts>): StepFacts => ({
  status: "draft",
  isOwner: false,
  isApprover: false,
  isLatest: true,
  note: "",
  readiness: confirms,
  ...overrides,
});

const allStatuses: QuoteStatus[] = [
  "draft",
  "submitted",
  "approved",
  "returned",
];

describe("decideStep: send", () => {
  it.each([
    "draft",
    "returned",
    "submitted",
  ] as const)("the owner confirms a %s costing that meets the minimum", (status) => {
    expect(decideStep("send", facts({ ...owner, status }))).toEqual({
      ok: true,
      status: "approved",
      history: "approved",
      note: CONFIRMED_NOTE,
    });
  });

  it.each([
    "draft",
    "returned",
  ] as const)("the owner sends a low %s costing with a reason", (status) => {
    expect(
      decideStep(
        "send",
        facts({
          ...owner,
          status,
          readiness: low,
          note: "  Competitor at RM 90  ",
        }),
      ),
    ).toEqual({
      ok: true,
      status: "submitted",
      history: "submitted",
      note: "Competitor at RM 90",
    });
  });

  it("needs a reason below the minimum", () => {
    const outcome = decideStep(
      "send",
      facts({ ...owner, readiness: low, note: "   " }),
    );
    expect(outcome).toEqual({
      ok: false,
      error: expect.stringMatching(/Write why/),
    });
  });

  it("sends a costing with missing cost for approval instead of confirming it", () => {
    const missing: Readiness = {
      ready: true,
      ownerConfirms: false,
      costMissing: true,
    };
    expect(
      decideStep(
        "send",
        facts({ ...owner, readiness: missing, note: "Rush job" }),
      ),
    ).toMatchObject({ ok: true, status: "submitted" });
  });

  it("refuses a low costing that is already waiting", () => {
    expect(
      decideStep(
        "send",
        facts({ ...owner, status: "submitted", readiness: low, note: "x" }),
      ),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/already waiting/),
    });
  });

  it("refuses an approved costing", () => {
    expect(
      decideStep("send", facts({ ...owner, status: "approved" })),
    ).toMatchObject({
      ok: false,
    });
  });

  it("refuses a costing that is not ready", () => {
    expect(
      decideStep(
        "send",
        facts({
          ...owner,
          readiness: { ready: false, problem: "Option A has no lines yet." },
        }),
      ),
    ).toEqual({ ok: false, error: "Option A has no lines yet." });
  });

  it.each([
    ["an approver", approver],
    ["someone else", bystander],
  ])("refuses %s who does not own it", (_who, role) => {
    expect(decideStep("send", facts({ ...role }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Only the salesperson/),
    });
  });
});

describe("decideStep: approve and return", () => {
  it("an approver approves a waiting costing, the note optional", () => {
    expect(
      decideStep("approve", facts({ ...approver, status: "submitted" })),
    ).toEqual({
      ok: true,
      status: "approved",
      history: "approved",
      note: "",
    });
  });

  it("an approver returns a waiting costing with a note", () => {
    expect(
      decideStep(
        "return",
        facts({ ...approver, status: "submitted", note: "Check freight" }),
      ),
    ).toEqual({
      ok: true,
      status: "returned",
      history: "returned",
      note: "Check freight",
    });
  });

  it("a return needs a note", () => {
    expect(
      decideStep("return", facts({ ...approver, status: "submitted" })),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/what needs changing/),
    });
  });

  it.each([
    "approve",
    "return",
  ] as const)("refuses to %s a costing that is not waiting", (step) => {
    for (const status of allStatuses.filter((s) => s !== "submitted")) {
      expect(
        decideStep(step, facts({ ...approver, status, note: "n" })),
      ).toMatchObject({
        ok: false,
      });
    }
  });

  it.each([
    "approve",
    "return",
  ] as const)("an approver may %s their own costing", (step) => {
    expect(
      decideStep(
        step,
        facts({ ...approverOwner, status: "submitted", note: "n" }),
      ),
    ).toMatchObject({ ok: true });
  });

  it.each([
    "approve",
    "return",
  ] as const)("an owner who is not an approver cannot %s", (step) => {
    expect(
      decideStep(step, facts({ ...owner, status: "submitted", note: "n" })),
    ).toMatchObject({ ok: false });
  });

  it.each(["approve", "return"] as const)("someone else cannot %s", (step) => {
    expect(
      decideStep(step, facts({ ...bystander, status: "submitted", note: "n" })),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/MD or Sales Director/),
    });
  });
});

describe("decideStep: choose and revise", () => {
  it("the owner records the customer's option on an approved costing", () => {
    expect(
      decideStep(
        "choose",
        facts({ ...owner, status: "approved", note: "Option B" }),
      ),
    ).toEqual({
      ok: true,
      status: "approved",
      history: "chosen",
      note: "Option B",
    });
  });

  it("the owner opens a new draft version from the latest approved costing", () => {
    expect(
      decideStep(
        "revise",
        facts({ ...owner, status: "approved", note: "Copied from Q1" }),
      ),
    ).toEqual({
      ok: true,
      status: "draft",
      history: "revised",
      note: "Copied from Q1",
    });
  });

  it("refuses a new version from an older one", () => {
    expect(
      decideStep(
        "revise",
        facts({ ...owner, status: "approved", isLatest: false }),
      ),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/newer version/),
    });
  });

  it.each([
    "choose",
    "revise",
  ] as const)("refuses to %s before it is OK to quote", (step) => {
    for (const status of allStatuses.filter((s) => s !== "approved")) {
      expect(decideStep(step, facts({ ...owner, status }))).toMatchObject({
        ok: false,
      });
    }
  });

  it.each(["choose", "revise"] as const)("only the owner may %s", (step) => {
    for (const role of [approver, bystander]) {
      expect(
        decideStep(step, facts({ ...role, status: "approved" })),
      ).toMatchObject({
        ok: false,
      });
    }
  });
});

describe("decideStep: every step against every status for a stranger", () => {
  const steps: ApprovalStep[] = [
    "send",
    "approve",
    "return",
    "choose",
    "revise",
  ];
  it("refuses everything to someone who neither owns nor approves", () => {
    for (const step of steps) {
      for (const status of allStatuses) {
        expect(
          decideStep(step, facts({ ...bystander, status, note: "n" })).ok,
        ).toBe(false);
      }
    }
  });
});
