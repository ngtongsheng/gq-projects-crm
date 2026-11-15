import type { ReactNode } from "react";
import { StatusBadge } from "@/components/app/status-badge";
import type { TeamTotals } from "@/lib/domain/sales-performance";
import { formatRm } from "@/lib/format/money";
import { TeamComparisonChart } from "./team-comparison-chart";

const SWATCH = [
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-1",
  "bg-chart-4",
  "bg-chart-5",
];

const percent = (value: number | null) =>
  value === null ? "–" : `${Math.round(value)}%`;

/** The team with the single highest value, or null when nobody leads (all null or a tie). */
function aheadOf(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  const best = Math.max(...present);
  return present.filter((value) => value === best).length === 1
    ? values.indexOf(best)
    : null;
}

type Line = {
  label: string;
  cell: (team: TeamTotals) => ReactNode;
  /** What "ahead" is measured on; none for lines nobody wins. */
  score?: (team: TeamTotals) => number | null;
  note?: (team: TeamTotals) => string;
};

/**
 * Two or more directors' teams side by side, each director counted in their own team, with the
 * monthly sales chart under the table. `monthIndex` is the month the "this month" line shows.
 */
export function TeamComparison({
  teams,
  year,
  monthIndex,
  monthLabel,
  expected,
  seesCost,
}: {
  teams: readonly TeamTotals[];
  year: number;
  monthIndex: number;
  monthLabel: string;
  expected: number;
  seesCost: boolean;
}) {
  const lines: Line[] = [
    {
      label: "People in team",
      cell: (team) => team.memberNames.length,
      note: (team) => team.memberNames.join(", "),
    },
    {
      label: `Sales ${year}`,
      cell: (team) => formatRm(team.row.ytd),
      score: (team) => team.row.ytd,
    },
    {
      label: `Target ${year}`,
      cell: (team) =>
        team.row.target === null ? "Not set" : formatRm(team.row.target),
    },
    {
      label: "Achieved",
      cell: (team) =>
        team.row.achievedPct === null ? (
          "–"
        ) : (
          <StatusBadge tone={team.row.achievedPct >= expected ? "good" : "bad"}>
            {percent(team.row.achievedPct)}
          </StatusBadge>
        ),
      score: (team) => team.row.achievedPct,
    },
    {
      label: `Sales ${monthLabel}`,
      cell: (team) => formatRm(team.row.months[monthIndex]),
      score: (team) => team.row.months[monthIndex],
    },
    {
      label: `MOFs ${year}`,
      cell: (team) => team.row.count,
      score: (team) => team.row.count,
    },
    ...(seesCost
      ? [
          {
            label: `Margin ${year}`,
            cell: (team: TeamTotals) => percent(team.row.marginPct),
            score: (team: TeamTotals) => team.row.marginPct,
            note: (team: TeamTotals) =>
              team.row.marginYtd === null ? "" : formatRm(team.row.marginYtd),
          },
        ]
      : []),
    {
      label: "Collected",
      cell: (team) => percent(team.row.collectedPct),
      note: (team) =>
        team.row.outstanding > 0
          ? `${formatRm(team.row.outstanding)} outstanding`
          : "",
    },
  ];

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-heading text-base font-semibold">
          Team comparison · {year}
        </h2>
        <p className="text-xs text-muted-foreground">
          Each director is counted in their own team. A team with no salesperson
          under the director shows the director&apos;s own sales only.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wider text-muted-foreground uppercase">
              <th className="py-2 pr-3 font-semibold" />
              {teams.map((team, index) => (
                <th
                  key={team.leadId}
                  className="px-3 py-2 text-right font-semibold whitespace-nowrap"
                >
                  <span
                    aria-hidden
                    className={`mr-1.5 inline-block size-2.5 rounded-xs ${SWATCH[index % SWATCH.length]}`}
                  />
                  {team.row.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const ahead = line.score ? aheadOf(teams.map(line.score)) : null;
              return (
                <tr key={line.label} className="border-t">
                  <th className="py-2 pr-3 text-left font-medium">
                    {line.label}
                  </th>
                  {teams.map((team, index) => {
                    const note = line.note?.(team);
                    return (
                      <td
                        key={team.leadId}
                        className="px-3 py-2 text-right align-top font-mono tabular-nums"
                      >
                        {line.cell(team)}
                        {ahead === index ? (
                          <span className="ml-1.5 align-middle font-sans">
                            <StatusBadge tone="good">Ahead</StatusBadge>
                          </span>
                        ) : null}
                        {note ? (
                          <span className="block font-sans text-xs text-muted-foreground">
                            {note}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Sales by month
        </h3>
        <TeamComparisonChart
          year={year}
          teams={teams.map((team) => ({
            name: team.row.name,
            months: team.row.months,
          }))}
        />
      </div>
    </section>
  );
}
