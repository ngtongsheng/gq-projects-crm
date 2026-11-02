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

// .invalid never resolves, so these sign-ins can never receive or send real mail.
export const TEST_USERS: TestUser[] = [
  {
    jobRole: "md",
    email: "test-md@example.invalid",
    fullName: "Farid Azman",
    role: "admin",
    yearlyTarget: null,
    arrangesStock: false,
  },
  {
    jobRole: "director",
    email: "test-director@example.invalid",
    fullName: "Lim Wei Jian",
    role: "staff",
    yearlyTarget: 2400000,
    arrangesStock: false,
  },
  {
    jobRole: "bd",
    email: "test-bd@example.invalid",
    fullName: "Priya Nair",
    role: "staff",
    yearlyTarget: 1800000,
    arrangesStock: false,
  },
  {
    jobRole: "sales",
    email: "test-sales@example.invalid",
    fullName: "Daniel Chong",
    role: "staff",
    yearlyTarget: 1500000,
    arrangesStock: false,
  },
  {
    jobRole: "accounts",
    email: "test-accounts@example.invalid",
    fullName: "Siti Aminah",
    role: "staff",
    yearlyTarget: null,
    arrangesStock: false,
  },
  {
    jobRole: "site",
    email: "test-site@example.invalid",
    fullName: "Raj Kumar",
    role: "staff",
    yearlyTarget: null,
    arrangesStock: false,
  },
  {
    jobRole: "support",
    email: "test-support@example.invalid",
    fullName: "Nurul Huda",
    role: "staff",
    yearlyTarget: null,
    arrangesStock: true,
  },
];
