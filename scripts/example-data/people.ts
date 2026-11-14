import { testSignInEmail } from "../../src/lib/auth/dev-sign-in.ts";
import type { JobRole } from "../../src/lib/auth/job-role.ts";
import type { Language } from "../../src/lib/i18n/dictionary.ts";

export const PERSON_KEYS = [
  "vicky",
  "eddie",
  "vanessa",
  "vernice",
  "vanisha",
  "cavan",
  "crystal",
  "jany",
  "awal",
  "akmal",
  "sarah",
  "jess",
  "waimun",
  "lisa",
  "marketingexec",
  "affifa",
  "liza",
] as const;
export type PersonKey = (typeof PERSON_KEYS)[number];

export type TestUser = {
  key: PersonKey;
  jobRole: JobRole;
  email: string;
  fullName: string;
  title: string;
  /** App role: who manages people. Only the MD is an admin. */
  role: "admin" | "staff";
  yearlyTarget: number | null;
  arrangesStock: boolean;
  sells: boolean;
  seesMargin: boolean;
  language: Language;
  /** A salesperson's team lead; must be a director or bd. */
  reportsTo: PersonKey | null;
  left: { on: string; reason: string } | null;
};

type Person = Pick<TestUser, "key" | "jobRole" | "fullName" | "title"> &
  Partial<Omit<TestUser, "key" | "jobRole" | "fullName" | "title" | "email">>;

// The demo's PEOPLE0. Sales leads: the demo defaults everyone to Eddie; Cavan and Crystal
// report to Vanessa here so both kinds of team lead have a team to test.
const PEOPLE: Person[] = [
  {
    key: "vicky",
    jobRole: "md",
    fullName: "Vicky",
    title: "Managing Director",
    role: "admin",
  },
  {
    key: "eddie",
    jobRole: "director",
    fullName: "Eddie",
    title: "Sales Director",
    yearlyTarget: 2400000,
  },
  {
    key: "vanessa",
    jobRole: "bd",
    fullName: "Vanessa",
    title: "Marketing Director",
    yearlyTarget: 1800000,
  },
  {
    key: "vernice",
    jobRole: "sales",
    fullName: "Vernice",
    title: "Salesperson",
    yearlyTarget: 1500000,
    reportsTo: "eddie",
  },
  {
    key: "vanisha",
    jobRole: "sales",
    fullName: "Vanisha",
    title: "Salesperson",
    yearlyTarget: 1500000,
    reportsTo: "eddie",
  },
  {
    key: "cavan",
    jobRole: "sales",
    fullName: "Cavan",
    title: "Salesperson",
    yearlyTarget: 1500000,
    reportsTo: "vanessa",
  },
  {
    key: "crystal",
    jobRole: "sales",
    fullName: "Crystal",
    title: "Salesperson",
    yearlyTarget: 1500000,
    reportsTo: "vanessa",
  },
  {
    key: "jany",
    jobRole: "accounts",
    fullName: "Jany",
    title: "HR & Accounts",
  },
  {
    key: "awal",
    jobRole: "site",
    fullName: "Awal",
    title: "Site Supervisor",
    language: "bm",
  },
  {
    key: "akmal",
    jobRole: "site",
    fullName: "Akmal",
    title: "Site Supervisor",
    language: "bm",
  },
  {
    key: "sarah",
    jobRole: "site",
    fullName: "Sarah",
    title: "Site Supervisor · walk-in wallpaper sales",
    sells: true,
  },
  {
    key: "jess",
    jobRole: "ssup",
    fullName: "Jess",
    title: "Sales support",
    arrangesStock: true,
  },
  {
    key: "waimun",
    jobRole: "support",
    fullName: "Wai Mun",
    title: "Purchasing · MOF, installation, delivery, PO",
    seesMargin: true,
  },
  {
    key: "lisa",
    jobRole: "support",
    fullName: "Lisa",
    title: "Purchasing assistant · MOF, installation, delivery",
    seesMargin: true,
    left: { on: "2026-11-10", reason: "Resigned" },
  },
  {
    key: "marketingexec",
    jobRole: "marketing",
    fullName: "Marketing Exec",
    title: "Marketing Executive (vacant)",
    left: { on: "2026-11-10", reason: "Position vacant" },
  },
  { key: "affifa", jobRole: "designer", fullName: "Affifa", title: "Designer" },
  { key: "liza", jobRole: "designer", fullName: "Liza", title: "Designer" },
];

export const TEST_USERS: TestUser[] = PEOPLE.map((p) => ({
  role: "staff",
  yearlyTarget: null,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  language: "en",
  reportsTo: null,
  left: null,
  ...p,
  email: testSignInEmail(p.key),
}));
