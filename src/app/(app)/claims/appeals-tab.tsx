import { Scale } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { formatDateTime } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { AppealPill } from "../commission/appeal-pill";
import { appealKey } from "../commission/appeal-rules";
import { loadCommissionAppeals } from "../commission/appeals-data";
import { loadCommissionLines } from "../commission/commission-data";
import { DecideAppealDialog } from "../commission/decide-appeal-dialog";

/** Every late-collection appeal the MD or HR & Accounts can see (D7), waiting ones first, with a Decide button. */
export async function AppealsTab({ myId }: { myId: string }) {
  const [appeals, lines] = await Promise.all([
    loadCommissionAppeals(),
    loadCommissionLines(),
  ]);
  // The late cut still taken off each line.
  const lateCutByLine = new Map(
    lines.map((line) => [
      appealKey(line.mofId, line.personId),
      line.commission.lateCut,
    ]),
  );
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
