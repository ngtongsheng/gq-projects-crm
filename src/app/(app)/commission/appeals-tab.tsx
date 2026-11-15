import { Scale } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { formatDateTime } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { AppealPill } from "./appeal-pill";
import { appealKey } from "./appeal-rules";
import type { CommissionAppeal } from "./appeals-data";
import { DecideAppealDialog } from "./decide-appeal-dialog";

type AppealsTabProps = {
  appeals: CommissionAppeal[];
  /** Late cut still taken off each line, by `appealKey`. */
  lateCutByLine: Map<string, number>;
  myId: string;
};

/** Every late-collection appeal the MD or HR & Accounts can see, waiting ones first, with a Decide button. */
export function AppealsTab({ appeals, lateCutByLine, myId }: AppealsTabProps) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="font-heading text-lg font-semibold">
          Late-collection appeals
        </h2>
        <p className="text-sm text-muted-foreground">
          Approving is a special favour. The salesperson sees it marked as
          special approval.
        </p>
      </div>
      {appeals.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Scale}
            title="No appeals"
            description="A salesperson's appeal against a late-collection cut appears here."
          />
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {appeals.map((appeal) => {
            const lateCut =
              lateCutByLine.get(appealKey(appeal.mofId, appeal.personId)) ?? 0;
            return (
              <li
                key={appeal.id}
                className="flex flex-wrap items-start gap-3 px-3.5 py-3"
              >
                <div className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5 text-sm">
                  <span className="font-medium">
                    {appeal.personName} ·{" "}
                    <span className="font-mono">{appeal.mofNo}</span>{" "}
                    {appeal.projectName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {appeal.companyName} · sent {formatDateTime(appeal.sentAt)}
                    {lateCut > 0 ? ` · cut ${formatRm(lateCut)}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground italic">
                    {appeal.reason}
                  </span>
                  {appeal.reply && (
                    <span className="text-xs text-muted-foreground">
                      {appeal.decidedByName}: {appeal.reply}
                    </span>
                  )}
                </div>
                {appeal.status === "pending" && appeal.personId !== myId ? (
                  <DecideAppealDialog
                    appealId={appeal.id}
                    personName={appeal.personName}
                    orderTitle={`${appeal.mofNo} · ${appeal.projectName} · ${appeal.companyName}`}
                    reason={appeal.reason}
                    sentOn={formatDateTime(appeal.sentAt)}
                    lateCut={lateCut}
                  />
                ) : (
                  <AppealPill appeal={appeal} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
