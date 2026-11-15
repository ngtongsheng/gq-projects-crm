import { Badge } from "@/components/ui/badge";
import type { SalesTeam } from "@/lib/domain/sales-teams";
import { formatRm } from "@/lib/format/money";

/** Each Sales Director and Marketing Director with the people who report to them. */
export function SalesTeamsPanel({
  teams,
  year,
}: {
  teams: SalesTeam[];
  year: number;
}) {
  if (teams.length === 0) return null;
  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-col gap-1 border-b px-4 py-3">
        <h2 className="font-heading text-base font-semibold">Sales teams</h2>
        <p className="text-sm text-muted-foreground">
          Each director sees only their own team's customers, calendar, sales,
          collection, commission and reports. The Managing Director sees
          everyone.
        </p>
      </header>
      <div className="grid gap-3 p-4 sm:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {teams.map((team) => (
          <div
            key={team.leadId}
            className="flex flex-col gap-2 rounded-lg border p-3"
          >
            <div>
              <p className="font-semibold">{team.leadName}'s team</p>
              {team.leadTitle && (
                <p className="text-sm text-muted-foreground">
                  {team.leadTitle}
                </p>
              )}
            </div>
            {team.members.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {team.members.map((member) => (
                  <li key={member.id}>
                    <Badge variant="secondary">{member.name}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No one reports to {team.leadName} yet. Choose "Reports to" in a
                person's settings to add them.
              </p>
            )}
            <p className="mt-auto text-sm text-muted-foreground">
              Team target {year}{" "}
              <span className="font-mono tabular-nums text-foreground">
                {team.targetTotal === null
                  ? "Not set"
                  : formatRm(team.targetTotal)}
              </span>
            </p>
          </div>
        ))}
      </div>
      <p className="border-t px-4 py-3 text-sm text-muted-foreground">
        To move someone, open their settings and change "Reports to". Their
        weekly report, monthly report and leave go to that director.
      </p>
    </section>
  );
}
