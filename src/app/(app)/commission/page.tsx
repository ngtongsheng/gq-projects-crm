import { Percent, Search, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canChangeSettings,
  canPayOutCommission,
  isManager,
} from "@/lib/auth/job-role";
import { loadMyTeam } from "@/lib/auth/my-team";
import { requireSection } from "@/lib/auth/require-section";
import { inMyTeam } from "@/lib/auth/team";
import { todayMyt } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { loadCommissionLines } from "./commission-data";
import { CommissionDialog } from "./commission-dialog";
import { groupByPerson, lineStatus } from "./commission-groups";

export const metadata: Metadata = { title: "Commission" };

const ALL = "all";

const personParam = z.uuid().optional().catch(undefined);

export default async function CommissionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireSection("commission");
  const seesEveryone = isManager(me.jobRole);
  const canPay = canPayOutCommission(me.jobRole);
  const canSetRules = canChangeSettings(me);
  const person = personParam.parse((await searchParams).person);
  const today = todayMyt();

  const [all, team] = await Promise.all([loadCommissionLines(), loadMyTeam()]);
  // The database limits the orders; a director's team order can still carry a line for someone
  // outside the team, whose payouts they cannot read. Lines follow the person, as in the demo.
  const mine = seesEveryone
    ? all.filter((line) => inMyTeam(team, line.personId))
    : all.filter((line) => line.personId === me.id);
  const people = groupByPerson(mine).map((group) => ({
    id: group.personId,
    name: group.personName,
  }));
  const groups = groupByPerson(
    seesEveryone && person
      ? mine.filter((line) => line.personId === person)
      : mine,
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Commission"
        description={
          seesEveryone
            ? "What each person has earned on money received, and what is left to pay out."
            : "Your commission on the orders registered under your name."
        }
        actions={
          canSetRules ? (
            <Button asChild variant="outline">
              <Link href="/commission/settings">
                <Settings data-icon="inline-start" />
                Commission settings
              </Link>
            </Button>
          ) : undefined
        }
      />
      {seesEveryone && (
        <form
          action="/commission"
          className="flex flex-wrap items-center gap-2"
        >
          <Select name="person" defaultValue={person ?? ALL}>
            <SelectTrigger aria-label="Person" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Everyone</SelectItem>
              {people.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline">
            <Search data-icon="inline-start" />
            Filter
          </Button>
        </form>
      )}
      {groups.length === 0 && (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Percent}
            title="No commission yet"
            description="Commission appears here once an order is registered under a salesperson."
          />
        </div>
      )}
      {groups.map((group) => (
        <section key={group.personId} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="font-heading text-lg font-semibold">
              {group.personName}
            </h2>
            <p className="font-mono text-sm tabular-nums text-muted-foreground">
              Earned {formatRm(group.earned)} · Paid out{" "}
              {formatRm(group.paidOut)} · Remaining {formatRm(group.remaining)}
            </p>
          </div>
          <DataTable
            rows={group.lines}
            getRowKey={(line) => `${line.mofId}-${line.personId}`}
            columns={[
              {
                key: "mofNo",
                header: "MOF no.",
                cell: (line) => (
                  <Link
                    href={`/mofs/${line.mofId}`}
                    className="font-mono font-medium hover:underline"
                  >
                    {line.mofNo}
                  </Link>
                ),
              },
              {
                key: "project",
                header: "Company / project",
                cell: (line) => (
                  <div className="flex flex-col">
                    <span className="font-medium">{line.companyName}</span>
                    <span className="text-xs text-muted-foreground">
                      {line.projectName}
                    </span>
                  </div>
                ),
              },
              {
                key: "rate",
                header: "Rate",
                numeric: true,
                cell: (line) =>
                  `${Number(line.commission.ratePct.toFixed(2))}%`,
              },
              {
                key: "earned",
                header: "Earned",
                numeric: true,
                cell: (line) => formatRm(line.commission.earned),
              },
              {
                key: "paidOut",
                header: "Paid out",
                numeric: true,
                cell: (line) => formatRm(line.balance.paidOut),
              },
              {
                key: "remaining",
                header: "Remaining",
                numeric: true,
                cell: (line) => formatRm(line.balance.remaining),
              },
              {
                key: "status",
                header: "Status",
                cell: (line) => {
                  const status = lineStatus(line);
                  return (
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  );
                },
              },
              {
                key: "details",
                header: "",
                cell: (line) => (
                  <CommissionDialog
                    mofId={line.mofId}
                    personId={line.personId}
                    title={`${line.mofNo} · ${line.personName}`}
                    lines={[...line.orderNotes, ...line.commission.lines]}
                    payouts={line.payouts}
                    remaining={line.balance.remaining}
                    payableNow={line.balance.payableNow}
                    canPay={canPay}
                    today={today}
                  />
                ),
              },
            ]}
          />
        </section>
      ))}
    </div>
  );
}
