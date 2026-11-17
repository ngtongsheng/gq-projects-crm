import { describe, expect, it } from "vitest";
import type {
  CustomSample,
  CustomSampleLoan,
} from "../custom-samples/custom-sample-types";
import type { PrepaidAccount } from "../marketing/marketing-types";
import {
  borrowedSampleReminders,
  claimsReadyReminder,
  officeSampleReminders,
  prepaidLowReminder,
  reminderPlan,
  travelClaimReminder,
} from "./home-reminders";

const t = (text: string) => text;

describe("travelClaimReminder", () => {
  // Cut-off day 25: the November claim covers 26 Oct to 25 Nov.
  const ask = (
    today: string,
    claim: { status: "draft" | "submitted" | "released" } | null,
  ) =>
    travelClaimReminder(
      { today, cutOffDay: 25, claim, month: "2026-11-01" },
      t,
    );

  it("starts 10 days before the cut-off", () => {
    expect(ask("2026-11-14", null)).toEqual([]);
    const [reminder] = ask("2026-11-15", null);
    expect(reminder.text).toBe(
      "Nov 2026 travel claim not submitted – cut-off 25 Nov 2026. Print it and attach the receipts.",
    );
    expect(reminder.href).toBe("/claims");
  });

  it("still asks on the cut-off day itself", () => {
    expect(ask("2026-11-25", null)).toHaveLength(1);
  });

  it("treats a draft like no claim", () => {
    expect(ask("2026-11-20", { status: "draft" })).toHaveLength(1);
  });

  it("stops once the claim is submitted or released", () => {
    expect(ask("2026-11-20", { status: "submitted" })).toEqual([]);
    expect(ask("2026-11-20", { status: "released" })).toEqual([]);
  });
});

describe("claimsReadyReminder", () => {
  it("counts the claims, singular and plural", () => {
    expect(claimsReadyReminder(0, t)).toEqual([]);
    expect(claimsReadyReminder(1, t)[0].text).toBe(
      "1 travel claim ready to release (monthly report submitted)",
    );
    const [many] = claimsReadyReminder(3, t);
    expect(many.text).toBe(
      "3 travel claims ready to release (monthly report submitted)",
    );
    expect(many.count).toBe(3);
  });
});

const loan = (over: Partial<CustomSampleLoan> = {}): CustomSampleLoan => ({
  id: "loan-1",
  salespersonId: "vernice",
  customer: "Hotel Seri",
  project: null,
  outOn: "2026-11-01",
  dueOn: "2026-11-15",
  returnedMarkedOn: null,
  backOn: null,
  givenAway: false,
  ...over,
});

const sample = (
  code: string,
  loans: CustomSampleLoan[],
  over: Partial<CustomSample> = {},
): CustomSample => ({
  id: `id-${code}`,
  code,
  receivedOn: "2026-10-01",
  designName: "Botanical swirl",
  designNo: "GQ-1",
  supplier: null,
  size: null,
  qty: 1,
  photoPath: null,
  photoUrl: null,
  notes: null,
  recordedBy: "designer",
  givenOn: null,
  givenTo: null,
  giftReason: null,
  givenBy: null,
  loans,
  ...over,
});

describe("borrowedSampleReminders", () => {
  const ask = (today: string, samples: CustomSample[], personId = "vernice") =>
    borrowedSampleReminders({ today, personId, samples }, t);

  it("starts 3 days before the due date", () => {
    const samples = [sample("TS-001", [loan()])];
    expect(ask("2026-11-11", samples)).toEqual([]);
    const [due] = ask("2026-11-12", samples);
    expect(due.text).toBe(
      "Return custom sample TS-001 Botanical swirl (Hotel Seri) – due 15 Nov 2026",
    );
    expect(due.tone).toBe("warn");
  });

  it("says overdue from the day after the due date", () => {
    const samples = [sample("TS-001", [loan()])];
    expect(ask("2026-11-15", samples)[0].text).toContain("– due 15 Nov 2026");
    const [late] = ask("2026-11-16", samples);
    expect(late.text).toContain("– overdue since 15 Nov 2026");
    expect(late.tone).toBe("bad");
  });

  it("is only for the borrower", () => {
    expect(ask("2026-11-16", [sample("TS-001", [loan()])], "other")).toEqual(
      [],
    );
  });

  it("drops a sample the borrower marked returned, and one given away", () => {
    const marked = sample("TS-001", [loan({ returnedMarkedOn: "2026-11-14" })]);
    const given = sample("TS-002", [loan({ backOn: "2026-11-14" })], {
      givenOn: "2026-11-14",
    });
    expect(ask("2026-11-16", [marked, given])).toEqual([]);
  });

  it("ignores loans that came back earlier", () => {
    const old = loan({ id: "old", dueOn: "2026-10-01", backOn: "2026-10-02" });
    expect(ask("2026-11-16", [sample("TS-001", [old])])).toEqual([]);
  });
});

describe("officeSampleReminders", () => {
  const nameOf = (id: string) => (id === "vernice" ? "Vernice" : "Sam");
  const ask = (today: string, samples: CustomSample[]) =>
    officeSampleReminders({ today, samples, nameOf }, t);

  it("lists returns to confirm and overdue samples with who holds them", () => {
    const samples = [
      sample("TS-001", [loan({ returnedMarkedOn: "2026-11-16" })]),
      sample("TS-002", [loan({ salespersonId: "sam", dueOn: "2026-11-10" })]),
      sample("TS-003", [loan({ salespersonId: "sam", dueOn: "2026-11-30" })]),
    ];
    const lines = ask("2026-11-16", samples);
    expect(lines.map((line) => line.text)).toEqual([
      "Confirm custom sample received back: TS-001 (Vernice)",
      "1 custom sample overdue – WhatsApp to return: TS-002 (Sam)",
    ]);
  });

  it("is not overdue on the due date, and a marked return is not overdue", () => {
    const samples = [
      sample("TS-001", [loan({ dueOn: "2026-11-16" })]),
      sample("TS-002", [
        loan({ dueOn: "2026-11-01", returnedMarkedOn: "2026-11-02" }),
      ]),
    ];
    expect(ask("2026-11-16", samples).map((line) => line.key)).toEqual([
      "customSamplesToConfirm",
    ]);
  });

  it("uses plurals for several samples", () => {
    const samples = [
      sample("TS-001", [loan({ dueOn: "2026-11-01" })]),
      sample("TS-002", [loan({ dueOn: "2026-11-02" })]),
    ];
    expect(ask("2026-11-16", samples)[0].text).toBe(
      "2 custom samples overdue – WhatsApp to return: TS-001 (Vernice), TS-002 (Vernice)",
    );
  });

  it("says nothing when there is nothing", () => {
    expect(ask("2026-11-16", [sample("TS-001", [])])).toEqual([]);
  });
});

describe("prepaidLowReminder", () => {
  const account = (over: Partial<PrepaidAccount>): PrepaidAccount => ({
    vendorId: "v1",
    vendorName: "Europe designer",
    toppedUp: 5000,
    used: 4500,
    balance: 500,
    jobs: 3,
    marketingFoc: 0,
    lastTopUpOn: null,
    lowBalanceAlert: 1000,
    low: true,
    ...over,
  });

  it("names each low vendor and its balance", () => {
    const [line] = prepaidLowReminder(
      [
        account({}),
        account({ vendorId: "v2", vendorName: "Printer", balance: 80 }),
      ],
      t,
    );
    expect(line.text).toBe(
      "Prepaid balance low – top up: Europe designer RM 500.00, Printer RM 80.00",
    );
    expect(line.count).toBe(2);
    expect(line.href).toBe("/marketing?view=prepaid");
  });

  it("opens the vendor when only one is low", () => {
    const [line] = prepaidLowReminder(
      [account({}), account({ vendorId: "v2", low: false })],
      t,
    );
    expect(line.href).toBe("/marketing?view=prepaid&vendor=v1");
  });

  it("says nothing when none is low", () => {
    expect(prepaidLowReminder([account({ low: false })], t)).toEqual([]);
  });
});

describe("reminderPlan", () => {
  const plan = (
    jobRole: Parameters<typeof reminderPlan>[0]["jobRole"],
    extra = {},
  ) => reminderPlan({ jobRole, sells: false, canFileClaim: false, ...extra });

  it("sends ready-to-release and prepaid reminders to accounts and the md only", () => {
    for (const jobRole of ["accounts", "md"] as const) {
      expect(plan(jobRole)).toMatchObject({
        readyToRelease: true,
        prepaidLow: true,
      });
    }
    for (const jobRole of ["sales", "designer", "ssup", "marketing"] as const) {
      expect(plan(jobRole)).toMatchObject({
        readyToRelease: false,
        prepaidLow: false,
      });
    }
  });

  it("sends sample confirm and overdue reminders to the designer, Senior Support and md", () => {
    for (const jobRole of ["designer", "ssup", "md"] as const) {
      expect(plan(jobRole).officeSamples).toBe(true);
    }
    for (const jobRole of [
      "support",
      "marketing",
      "director",
      "accounts",
    ] as const) {
      expect(plan(jobRole).officeSamples).toBe(false);
    }
  });

  it("chases lent samples only for people who borrow", () => {
    expect(plan("sales").borrowedSamples).toBe(true);
    expect(plan("support").borrowedSamples).toBe(false);
    expect(plan("support", { sells: true }).borrowedSamples).toBe(true);
    expect(plan("site", { sells: true }).borrowedSamples).toBe(false);
  });

  it("asks for the travel claim only from people who file one", () => {
    expect(plan("sales", { canFileClaim: true }).travelClaim).toBe(true);
    expect(plan("md").travelClaim).toBe(false);
  });
});
