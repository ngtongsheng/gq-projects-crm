import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { type SectionKey, sectionsFor } from "@/lib/auth/nav-sections";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Guide" };

const SCREEN_GUIDE: Record<SectionKey, string> = {
  dashboard:
    "Your headline numbers: sales activity and, for managers, MOF and project progress.",
  salesCalendar:
    "Your visits and follow-ups by day and week. Add a visit from here.",
  installation:
    "Installation and delivery dates, and who is free to book a site supervisor.",
  customers:
    "Customer records and contacts. Everyone can look up any customer; the owner or a manager changes it, and anyone else can ask for ownership from here.",
  projects: "Projects moving through the pipeline, from first contact to job.",
  mof: "The MOF register: client purchase orders as they come in, then supplier orders and deliveries.",
  siteWork:
    "Site visits, actions needed, handover forms and balance stock, logged by site supervisors.",
  overtime:
    "Overtime claims. Site supervisors and staff submit them; managers approve.",
  stock: "Stock items, what is reserved and what is left over.",
  collection: "Payments received against sales.",
  commission: "Commission claims and the rules that apply to each person.",
  reports: "Your monthly report. Managers open the team's reports from here.",
  directorReport:
    "The monthly report for the director level, including leads passed down to salespeople.",
  guide: "This page: what each screen is for.",
};

export default async function GuidePage() {
  const profile = await requireRole("staff");
  const screens = sectionsFor(profile.jobRole);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Guide"
        description="The screens you can open, and what each one is for."
      />
      <p className="max-w-prose text-sm">
        Pick a screen in the sidebar. Each job role sees different screens and
        different records, so your list may differ from a colleague's.
      </p>
      <ul className="divide-y rounded-lg border bg-card">
        {screens.map((screen) => (
          <li key={screen.key} className="flex flex-col gap-1 p-4">
            <span className="font-heading text-base font-medium">
              {screen.label}
            </span>
            <span className="text-sm text-muted-foreground">
              {SCREEN_GUIDE[screen.key]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
