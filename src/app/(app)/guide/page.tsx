import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { loadAccessOverrides } from "@/lib/auth/access-overrides";
import { navPagesFor, type PageKey } from "@/lib/auth/pages";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Guide" };

// Pages not built yet have no entry; they never reach the sidebar.
const SCREEN_GUIDE: Partial<Record<PageKey, string>> = {
  dash: "Your headline numbers: sales activity and, for managers, MOF and project progress.",
  cal: "Your visits and follow-ups by day and week. Add a visit from here.",
  inst: "Installation and delivery dates, and who is free to book a site supervisor.",
  cust: "Customer records and contacts. Everyone can look up any customer; the owner or a manager changes it, and anyone else can ask for ownership from here.",
  proj: "Projects moving through the pipeline, from first contact to job.",
  mof: "The MOF register: client purchase orders as they come in, then supplier orders and deliveries.",
  site: "Site visits, actions needed, handover forms and balance stock, logged by site supervisors.",
  claims:
    "Overtime claims. Site supervisors and staff submit them; managers approve.",
  stock: "Stock items, what is reserved and what is left over.",
  coll: "Payments received against sales.",
  comm: "Commission claims and the rules that apply to each person.",
  rep: "Your monthly report. Managers open the team's reports from here.",
  srep: "Your monthly site report.",
  drep: "The monthly report for the director level, including leads passed down to salespeople.",
};

export default async function GuidePage() {
  const profile = await requireRole("staff");
  const screens = navPagesFor(profile, await loadAccessOverrides());

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
