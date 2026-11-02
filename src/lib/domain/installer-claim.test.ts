import { describe, expect, it } from "vitest";
import {
  claimState,
  exceedsInstallerPo,
  type InstallerClaimType,
  summariseInstallerPo,
} from "./installer-claim";

const claim = (
  type: InstallerClaimType,
  amount: number,
  extra: { verified?: boolean; paidAmount?: number } = {},
) => ({ type, amount, verified: false, paidAmount: 0, ...extra });

describe("summariseInstallerPo", () => {
  it("owes claimed less retention when nothing is deducted or paid", () => {
    const summary = summariseInstallerPo({ amount: 28000, retentionPct: 5 }, [
      claim("progress", 12000, { verified: true }),
    ]);

    expect(summary).toMatchObject({
      claimed: 12000,
      deducted: 0,
      retention: 600,
      paid: 0,
      due: 11400,
      leftToClaim: 16000,
    });
  });

  it("takes deductions off what is due", () => {
    const summary = summariseInstallerPo({ amount: 45000, retentionPct: 5 }, [
      claim("progress", 30000, { verified: true, paidAmount: 28500 }),
      claim("final", 12000, { verified: true }),
      claim("deduction", 800),
    ]);

    expect(summary.claimed).toBe(42000);
    expect(summary.deducted).toBe(800);
    expect(summary.retention).toBe(2100);
    expect(summary.paid).toBe(28500);
    expect(summary.due).toBe(10600);
  });

  it("does not hold retention back when the PO has none", () => {
    const summary = summariseInstallerPo({ amount: 18000, retentionPct: 0 }, [
      claim("final", 18000, { verified: true, paidAmount: 18000 }),
    ]);

    expect(summary.retention).toBe(0);
    expect(summary.due).toBe(0);
    expect(summary.leftToClaim).toBe(0);
  });

  it("rounds retention to the nearest cent on the total", () => {
    const summary = summariseInstallerPo({ amount: 5000, retentionPct: 7.5 }, [
      claim("progress", 333.33),
      claim("progress", 333.33),
    ]);

    // 666.66 x 7.5% = 49.9995
    expect(summary.retention).toBe(50);
    expect(summary.due).toBe(616.66);
  });

  it("adds on cents so small amounts do not drift", () => {
    const summary = summariseInstallerPo({ amount: 100, retentionPct: 0 }, [
      claim("progress", 0.1),
      claim("progress", 0.2),
    ]);

    expect(summary.claimed).toBe(0.3);
  });

  it("never shows a negative amount due", () => {
    const summary = summariseInstallerPo({ amount: 1000, retentionPct: 5 }, [
      claim("progress", 500, { verified: true }),
      claim("deduction", 600),
    ]);

    expect(summary.due).toBe(0);
  });

  it("counts claims still waiting for the site supervisor", () => {
    const summary = summariseInstallerPo({ amount: 1000, retentionPct: 0 }, [
      claim("progress", 100, { verified: true }),
      claim("progress", 100),
      claim("deduction", 50),
    ]);

    expect(summary.unverifiedCount).toBe(1);
  });
});

describe("claimState", () => {
  it("follows a claim from unverified to paid", () => {
    expect(claimState(claim("progress", 100))).toBe("unverified");
    expect(claimState(claim("progress", 100, { verified: true }))).toBe(
      "verified",
    );
    expect(
      claimState(claim("progress", 100, { verified: true, paidAmount: 95 })),
    ).toBe("paid");
    expect(claimState(claim("deduction", 100))).toBe("deduction");
  });
});

describe("exceedsInstallerPo", () => {
  it("allows claims up to the PO amount and no further", () => {
    expect(exceedsInstallerPo(1000, 600, 400)).toBe(false);
    expect(exceedsInstallerPo(1000, 600, 400.01)).toBe(true);
  });
});
