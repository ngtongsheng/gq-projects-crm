import type { JobRole } from "@/lib/auth/job-role";

export type AttentionKey =
  | "ownershipRequests"
  | "overdueProjects"
  | "staleProjects"
  | "inactiveCustomers"
  | "lateReports"
  | "ownReport"
  | "pendingOvertime"
  | "overdueFollowUps"
  | "pendingBookings"
  | "claimsToVerify"
  | "overdueSupplierPos"
  | "missingSupplierPos"
  | "unsignedDos"
  | "stockHolds"
  | "creditNotes";

/** How many things need attention, per kind. A missing kind counts as none. */
export type AttentionFacts = Partial<Record<AttentionKey, number>>;

export type AttentionItem = {
  key: AttentionKey;
  label: string;
  count: number;
  href: string;
  tone: "bad" | "warn" | "info";
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

type Rule = {
  tone: AttentionItem["tone"];
  href: (jobRole: JobRole) => string;
  label: (count: number) => string;
};

const RULES: Record<AttentionKey, Rule> = {
  ownershipRequests: {
    tone: "warn",
    href: () => "/customers/ownership",
    label: (n) =>
      `${plural(n, "ownership request", "ownership requests")} to decide`,
  },
  overdueProjects: {
    tone: "bad",
    href: () => "/projects",
    label: (n) =>
      `${plural(n, "project", "projects")} past the next action date`,
  },
  staleProjects: {
    tone: "warn",
    href: () => "/projects",
    label: (n) =>
      `${plural(n, "project", "projects")} not updated in over 14 days`,
  },
  inactiveCustomers: {
    tone: "warn",
    href: () => "/customers",
    label: (n) =>
      `${plural(n, "customer", "customers")} with no activity in over 90 days`,
  },
  lateReports: {
    tone: "bad",
    href: () => "/reports/team",
    label: (n) => `${plural(n, "monthly report", "monthly reports")} overdue`,
  },
  ownReport: {
    tone: "bad",
    href: (jobRole) => (jobRole === "bd" ? "/reports/director" : "/reports"),
    label: () => "Your monthly report is overdue",
  },
  pendingOvertime: {
    tone: "info",
    href: () => "/overtime",
    label: (n) => `${plural(n, "overtime claim", "overtime claims")} to decide`,
  },
  overdueFollowUps: {
    tone: "bad",
    href: () => "/site-work",
    label: (n) => `${plural(n, "site follow-up", "site follow-ups")} overdue`,
  },
  pendingBookings: {
    tone: "warn",
    href: () => "/installation",
    label: (n) =>
      `${plural(n, "booking request", "booking requests")} to answer`,
  },
  claimsToVerify: {
    tone: "info",
    href: () => "/site-work",
    label: (n) =>
      `${plural(n, "installer claim", "installer claims")} to verify`,
  },
  overdueSupplierPos: {
    tone: "bad",
    href: () => "/mofs",
    label: (n) =>
      `${plural(n, "supplier PO", "supplier POs")} past the expected arrival`,
  },
  missingSupplierPos: {
    tone: "warn",
    href: () => "/mofs",
    label: (n) => `${plural(n, "MOF", "MOFs")} still without a supplier PO`,
  },
  unsignedDos: {
    tone: "warn",
    href: () => "/installation",
    label: (n) =>
      `${plural(n, "delivery order", "delivery orders")} not signed back`,
  },
  stockHolds: {
    tone: "warn",
    href: () => "/stock",
    label: (n) =>
      `${plural(n, "stock hold", "stock holds")} waiting, expiring or expired`,
  },
  creditNotes: {
    tone: "info",
    href: () => "/stock/leftover",
    label: (n) =>
      `${plural(n, "supplier return", "supplier returns")} waiting for a credit note`,
  },
};

// What each job role is expected to act on, in the order it is shown.
const KEYS_BY_ROLE: Record<JobRole, readonly AttentionKey[]> = {
  md: [
    "ownershipRequests",
    "lateReports",
    "overdueProjects",
    "staleProjects",
    "inactiveCustomers",
    "pendingOvertime",
    "overdueFollowUps",
    "claimsToVerify",
    "overdueSupplierPos",
    "missingSupplierPos",
    "unsignedDos",
  ],
  director: [
    "ownershipRequests",
    "lateReports",
    "overdueProjects",
    "staleProjects",
    "inactiveCustomers",
    "pendingOvertime",
    "overdueFollowUps",
    "claimsToVerify",
  ],
  accounts: ["lateReports"],
  bd: ["ownReport", "overdueProjects", "staleProjects", "inactiveCustomers"],
  sales: ["ownReport", "overdueProjects", "staleProjects", "inactiveCustomers"],
  support: [
    "overdueSupplierPos",
    "missingSupplierPos",
    "unsignedDos",
    "stockHolds",
    "creditNotes",
    "overdueFollowUps",
  ],
  site: ["pendingBookings", "overdueFollowUps", "claimsToVerify", "ownReport"],
};

/** The kinds of attention a role acts on, so a dashboard only loads what it will show. */
export const attentionKeysFor = (jobRole: JobRole): readonly AttentionKey[] =>
  KEYS_BY_ROLE[jobRole];

/** What needs this role's attention today: only kinds the role acts on, and only those above zero. */
export function attentionItems(
  jobRole: JobRole,
  facts: AttentionFacts,
): AttentionItem[] {
  return KEYS_BY_ROLE[jobRole].flatMap((key) => {
    const count = facts[key] ?? 0;
    if (count <= 0) return [];
    const rule = RULES[key];
    return [
      {
        key,
        label: rule.label(count),
        count,
        href: rule.href(jobRole),
        tone: rule.tone,
      },
    ];
  });
}

export const attentionTotal = (items: readonly AttentionItem[]): number =>
  items.reduce((total, item) => total + item.count, 0);
