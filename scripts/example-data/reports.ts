import { at, monthStart, previousMonthStart } from "./dates.ts";
import { exampleId } from "./ids.ts";
import type { BuildContext, ExampleTable, Row } from "./types.ts";

export function buildMonthlyReports({
  people,
  today,
}: BuildContext): ExampleTable {
  const lastMonth = previousMonthStart(today);
  const thisMonth = monthStart(today);
  // The stats are the figures frozen at submit; their shape is ReportStats in report-stats.ts.
  const salesStats = {
    kind: "sales",
    visits: 38,
    visitTarget: 50,
    newCustomers: 3,
    quotations: 6,
    awardedCount: 1,
    awardedValue: 96000,
  };
  const rows: Row[] = [
    {
      key: "rep1",
      profile_id: people.vernice,
      month: lastMonth,
      kind: "sales",
      status: "reviewed",
      stats: salesStats,
      highlights: [
        {
          company: "Bukit Rimba Development",
          achievement: "Awarded the show unit package.",
        },
      ],
      next_month_plan:
        "Close the Kiara hotel lobby and present the condo lobbies.",
      support_needed: null,
      pass_downs_confirmed: false,
      submitted_at: at(thisMonth, 0, "09:00"),
      reviewed_by: people.eddie,
      reviewed_at: at(thisMonth, 0, "11:00"),
      review_note: "Good month. Push the Kiara price this week.",
    },
    {
      key: "rep2",
      profile_id: people.vanessa,
      month: lastMonth,
      kind: "bd",
      status: "submitted",
      stats: {
        ...salesStats,
        kind: "bd",
        passDownCount: 1,
        passDownValue: 96000,
        awardedCount: 0,
        awardedValue: 0,
      },
      highlights: [
        {
          company: "Orion Builders",
          achievement: "Registered for the Level 12 tender.",
        },
      ],
      next_month_plan: "Prepare the tender pack.",
      support_needed: "Costing support for the tender.",
      pass_downs_confirmed: true,
      submitted_at: at(thisMonth, 0, "10:00"),
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
    },
    {
      key: "rep3",
      profile_id: people.awal,
      month: lastMonth,
      kind: "site",
      status: "reviewed",
      stats: {
        kind: "site",
        siteVisits: 44,
        siteVisitTarget: 50,
        shootings: 3,
        shootingTarget: 5,
        handovers: 2,
        handoverTarget: 5,
        otHours: 11.5,
      },
      highlights: [
        {
          company: "Meridian Interiors",
          achievement: "Reception handed over on time.",
        },
      ],
      next_month_plan: "Start the ballroom installation.",
      support_needed: null,
      pass_downs_confirmed: false,
      submitted_at: at(thisMonth, 0, "08:30"),
      reviewed_by: people.vicky,
      reviewed_at: at(thisMonth, 0, "11:30"),
      review_note: null,
    },
    {
      key: "rep4",
      profile_id: people.vernice,
      month: thisMonth,
      kind: "sales",
      status: "draft",
      stats: null,
      highlights: [],
      next_month_plan: null,
      support_needed: null,
      pass_downs_confirmed: false,
      submitted_at: null,
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
    },
  ].map(({ key, ...row }) => ({
    id: exampleId("monthly_reports", String(key)),
    ...row,
  }));
  return { table: "monthly_reports", key: "id", rows };
}
