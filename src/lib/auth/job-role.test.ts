import { describe, expect, it } from "vitest";
import {
  canEditRegister,
  canEditSite,
  canEditStock,
  canEnterPayments,
  canScheduleJobs,
  canUpdateJobStatus,
  isManager,
  isReadOnly,
  JobRole,
} from "./job-role";

type Row = {
  manager: boolean;
  readOnly: boolean;
  register: boolean;
  site: boolean;
  payments: boolean;
  stock: boolean;
};

// Expected capabilities per job role, from the prototype.
const expected: Record<JobRole, Row> = {
  md: {
    manager: true,
    readOnly: false,
    register: true,
    site: true,
    payments: true,
    stock: true,
  },
  director: {
    manager: true,
    readOnly: false,
    register: false,
    site: true,
    payments: false,
    stock: true,
  },
  bd: {
    manager: false,
    readOnly: false,
    register: false,
    site: false,
    payments: false,
    stock: false,
  },
  sales: {
    manager: false,
    readOnly: false,
    register: false,
    site: false,
    payments: false,
    stock: false,
  },
  accounts: {
    manager: true,
    readOnly: true,
    register: true,
    site: false,
    payments: true,
    stock: false,
  },
  site: {
    manager: false,
    readOnly: false,
    register: false,
    site: true,
    payments: false,
    stock: false,
  },
  support: {
    manager: false,
    readOnly: false,
    register: true,
    site: false,
    payments: false,
    stock: true,
  },
};

describe("job role capabilities", () => {
  it.each(JobRole.options)("%s", (jobRole) => {
    expect({
      manager: isManager(jobRole),
      readOnly: isReadOnly(jobRole),
      register: canEditRegister(jobRole),
      site: canEditSite(jobRole),
      payments: canEnterPayments(jobRole),
      stock: canEditStock({ jobRole, arrangesStock: false }),
    }).toEqual(expected[jobRole]);
  });

  it.each(
    JobRole.options,
  )("%s can edit stock when they arrange stock", (jobRole) => {
    expect(canEditStock({ jobRole, arrangesStock: true })).toBe(true);
  });
});

describe("job scheduling", () => {
  it("lets the MD, Sales Director and Purchasing schedule jobs", () => {
    expect(JobRole.options.filter(canScheduleJobs)).toEqual([
      "md",
      "director",
      "support",
    ]);
  });

  it("also lets Site Supervisors move a job's status", () => {
    expect(JobRole.options.filter(canUpdateJobStatus)).toEqual([
      "md",
      "director",
      "site",
      "support",
    ]);
  });
});
