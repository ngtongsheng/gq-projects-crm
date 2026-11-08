import { TEST_SIGN_IN_EMAILS } from "../../src/lib/auth/dev-sign-in.ts";
import type { JobRole } from "../../src/lib/auth/job-role.ts";

export type TestUser = {
  jobRole: JobRole;
  email: string;
  fullName: string;
  /** App role: who manages people. Only the MD is an admin. */
  role: "admin" | "staff";
  yearlyTarget: number | null;
  arrangesStock: boolean;
};

export const TEST_USERS: TestUser[] = [
  {
    jobRole: "md",
    email: TEST_SIGN_IN_EMAILS.md,
    fullName: "Farid Azman",
    role: "admin",
    yearlyTarget: null,
    arrangesStock: false,
  },
  {
    jobRole: "director",
    email: TEST_SIGN_IN_EMAILS.director,
    fullName: "Lim Wei Jian",
    role: "staff",
    yearlyTarget: 2400000,
    arrangesStock: false,
  },
  {
    jobRole: "bd",
    email: TEST_SIGN_IN_EMAILS.bd,
    fullName: "Priya Nair",
    role: "staff",
    yearlyTarget: 1800000,
    arrangesStock: false,
  },
  {
    jobRole: "sales",
    email: TEST_SIGN_IN_EMAILS.sales,
    fullName: "Daniel Chong",
    role: "staff",
    yearlyTarget: 1500000,
    arrangesStock: false,
  },
  {
    jobRole: "accounts",
    email: TEST_SIGN_IN_EMAILS.accounts,
    fullName: "Siti Aminah",
    role: "staff",
    yearlyTarget: null,
    arrangesStock: false,
  },
  {
    jobRole: "site",
    email: TEST_SIGN_IN_EMAILS.site,
    fullName: "Raj Kumar",
    role: "staff",
    yearlyTarget: null,
    arrangesStock: false,
  },
  {
    jobRole: "support",
    email: TEST_SIGN_IN_EMAILS.support,
    fullName: "Nurul Huda",
    role: "staff",
    yearlyTarget: null,
    arrangesStock: true,
  },
];
