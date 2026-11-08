import {
  Banknote,
  BookOpen,
  Boxes,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderKanban,
  HardHat,
  LayoutGrid,
  type LucideIcon,
  Moon,
  Percent,
  Target,
  Truck,
  Users,
} from "lucide-react";
import { isManager, type JobRole } from "./job-role";

export type ModuleKey = "crm";

export type SectionKey =
  | "dashboard"
  | "salesCalendar"
  | "installation"
  | "customers"
  | "projects"
  | "mof"
  | "siteWork"
  | "overtime"
  | "stock"
  | "collection"
  | "commission"
  | "reports"
  | "directorReport"
  | "guide";

type Section = {
  key: SectionKey;
  module: ModuleKey;
  label: string;
  /** Role-specific wording, e.g. "My Sales" for a salesperson's view of the MOF register. */
  labelFor?: (jobRole: JobRole) => string;
  href: string;
  /** Role-specific page, e.g. managers open Team Reports rather than their own report. */
  hrefFor?: (jobRole: JobRole) => string;
  icon: LucideIcon;
  allowed: readonly JobRole[];
};

const SALES_SIDE: readonly JobRole[] = [
  "md",
  "director",
  "bd",
  "sales",
  "accounts",
];

// Order is the sidebar order. Mirrors the prototype's tabsDef.
const SECTIONS: readonly Section[] = [
  {
    key: "dashboard",
    module: "crm",
    label: "Dashboard",
    href: "/",
    icon: LayoutGrid,
    allowed: [...SALES_SIDE, "support"],
  },
  {
    key: "salesCalendar",
    module: "crm",
    label: "Sales Calendar",
    href: "/calendar",
    icon: CalendarDays,
    allowed: SALES_SIDE,
  },
  {
    key: "installation",
    module: "crm",
    label: "Installation",
    labelFor: (jobRole) =>
      jobRole === "site"
        ? "Installation Calendar"
        : jobRole === "support"
          ? "Delivery & Installation"
          : "Installation",
    href: "/installation",
    icon: Truck,
    allowed: [...SALES_SIDE, "site", "support"],
  },
  {
    key: "customers",
    module: "crm",
    label: "Customers",
    href: "/customers",
    icon: Users,
    allowed: SALES_SIDE,
  },
  {
    key: "projects",
    module: "crm",
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
    allowed: SALES_SIDE,
  },
  {
    key: "mof",
    module: "crm",
    label: "MOF Register",
    labelFor: (jobRole) =>
      isManager(jobRole) || jobRole === "support" ? "MOF Register" : "My Sales",
    href: "/mofs",
    icon: FileText,
    // The Sales Director sees the team's work elsewhere, so no MOF entry.
    allowed: ["md", "bd", "sales", "accounts", "support"],
  },
  {
    key: "siteWork",
    module: "crm",
    label: "Site Work",
    href: "/site-work",
    icon: HardHat,
    allowed: [...SALES_SIDE, "site", "support"],
  },
  {
    key: "overtime",
    module: "crm",
    label: "Overtime",
    href: "/overtime",
    icon: Moon,
    allowed: ["md", "director", "bd", "sales", "accounts", "site", "support"],
  },
  {
    key: "stock",
    module: "crm",
    label: "Stock",
    href: "/stock",
    icon: Boxes,
    allowed: [...SALES_SIDE, "support"],
  },
  {
    key: "collection",
    module: "crm",
    label: "Collection",
    href: "/collection",
    icon: Banknote,
    allowed: SALES_SIDE,
  },
  {
    key: "commission",
    module: "crm",
    label: "Commission",
    href: "/commission",
    icon: Percent,
    allowed: SALES_SIDE,
  },
  {
    key: "reports",
    module: "crm",
    label: "My Report",
    labelFor: (jobRole) => (isManager(jobRole) ? "Team Reports" : "My Report"),
    href: "/reports",
    hrefFor: (jobRole) => (isManager(jobRole) ? "/reports/team" : "/reports"),
    icon: ClipboardList,
    // The BD Director's monthly report sits under Director Report, as in the prototype.
    allowed: ["md", "director", "sales", "accounts", "site"],
  },
  {
    key: "directorReport",
    module: "crm",
    label: "Director Report",
    href: "/reports/director",
    icon: Target,
    allowed: ["md", "director", "bd", "accounts"],
  },
  {
    key: "guide",
    module: "crm",
    label: "Guide",
    href: "/guide",
    icon: BookOpen,
    allowed: [...SALES_SIDE, "site", "support"],
  },
];

export type NavSection = {
  key: SectionKey;
  label: string;
  href: string;
  icon: LucideIcon;
};

const toNavSection = (section: Section, jobRole: JobRole): NavSection => ({
  key: section.key,
  label: section.labelFor?.(jobRole) ?? section.label,
  href: section.hrefFor?.(jobRole) ?? section.href,
  icon: section.icon,
});

/** The sections the role may open, in sidebar order. */
export const sectionsFor = (jobRole: JobRole): NavSection[] =>
  SECTIONS.filter((s) => s.allowed.includes(jobRole)).map((s) =>
    toNavSection(s, jobRole),
  );

const MODULE_LABELS: Record<ModuleKey, string> = { crm: "CRM" };

export type NavModule = {
  key: ModuleKey;
  label: string;
  sections: NavSection[];
};

/** The modules the role can open, each with its sections in sidebar order. */
export const modulesFor = (jobRole: JobRole): NavModule[] => {
  const sections = SECTIONS.filter((s) => s.allowed.includes(jobRole));
  return (Object.keys(MODULE_LABELS) as ModuleKey[])
    .map((key) => ({
      key,
      label: MODULE_LABELS[key],
      sections: sections
        .filter((s) => s.module === key)
        .map((s) => toNavSection(s, jobRole)),
    }))
    .filter((m) => m.sections.length > 0);
};

export const canOpenSection = (jobRole: JobRole, key: SectionKey): boolean =>
  SECTIONS.some((s) => s.key === key && s.allowed.includes(jobRole));
