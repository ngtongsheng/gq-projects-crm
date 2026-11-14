import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { canApproveQuote } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { formatDateTime } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { EnquiryPanel } from "../enquiry-panel";
import { loadQuote } from "../quote-data";
import { QUOTE_STATUS_TONE, QuoteStatusLabel } from "../quote-status";
import type { QuoteView } from "../quote-view";
import { ApprovalBar } from "./approval-bar";
import { loadApprovalRevision } from "./approval-revision";
import { MissingRevision } from "./missing-revision";
import { QuoteEditor } from "./quote-editor";

export const metadata: Metadata = { title: "Costing" };

type Revision = QuoteView["revisions"][number];
type HistoryEntry = Revision["history"][number];

const HISTORY_TEXT: Record<HistoryEntry["action"], string> = {
  created: "Started",
  edited: "Changed after it was submitted",
  revised: "Opened as a new version",
  submitted: "Submitted for approval",
  approved: "Approved",
  returned: "Returned for changes",
  chosen: "Customer chose an option",
};

const revisionName = (quoteNo: string, rev: number) =>
  rev > 0 ? `${quoteNo}-R${rev}` : quoteNo;

const single = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : null;

export default async function CostingRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("cost");
  const { id } = await params;
  const search = await searchParams;
  const quote = await loadQuote(me, id);
  if (!quote) notFound();

  const isOwner = quote.salespersonId === me.id;
  const wanted = single(search.rev);
  const revision =
    quote.revisions.find((candidate) => String(candidate.rev) === wanted) ??
    quote.revisions.at(-1);

  if (!revision) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={quote.quoteNo}
          description={`${quote.projectName || "No project"} · ${quote.customerName || "No customer"}`}
        />
        <MissingRevision
          quoteId={quote.id}
          salespersonName={quote.salespersonName}
          canStart={isOwner}
        />
      </div>
    );
  }

  const approved = revision.status === "approved";
  const canEdit = isOwner && !approved;
  const lockNote = !isOwner
    ? `Read-only. Only ${quote.salespersonName} can change this costing.`
    : "OK to quote, so it is locked. Open a new version to change it.";
  const last = revision.history.at(-1);
  const latestRev = quote.revisions.at(-1)?.rev ?? revision.rev;
  // Whether the owner may confirm alone is worked out from the stored cost, whoever is looking.
  const readiness =
    isOwner && !approved
      ? ((await loadApprovalRevision(await createClient(), revision.id))
          ?.readiness ?? null)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={revisionName(quote.quoteNo, revision.rev)}
        description={
          last
            ? `${HISTORY_TEXT[last.action]} · ${last.byName} · ${formatDateTime(last.at)}`
            : undefined
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/costing/${quote.id}/preview?rev=${revision.rev}`}>
                Client quote
              </Link>
            </Button>
            <StatusBadge tone={QUOTE_STATUS_TONE[revision.status]}>
              {QuoteStatusLabel[revision.status]}
            </StatusBadge>
          </>
        }
      />
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Project</dt>
          <dd>{quote.projectName || "–"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Customer</dt>
          <dd>{quote.customerName || "–"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Salesperson</dt>
          <dd>{quote.salespersonName}</dd>
        </div>
      </dl>
      <div
        role="tablist"
        aria-label="Versions"
        className="flex flex-wrap gap-2"
      >
        {quote.revisions.map((candidate) => (
          <Link
            key={candidate.id}
            role="tab"
            aria-selected={candidate.id === revision.id}
            href={`/costing/${quote.id}?rev=${candidate.rev}`}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted/50",
              candidate.id === revision.id && "border-primary bg-muted",
            )}
          >
            <span className="font-mono">
              {candidate.rev > 0 ? `R${candidate.rev}` : "Original"}
            </span>
            <StatusBadge tone={QUOTE_STATUS_TONE[candidate.status]}>
              {QuoteStatusLabel[candidate.status]}
            </StatusBadge>
          </Link>
        ))}
      </div>
      <QuoteEditor
        // A saved change, an added option or a removed one gives the editor fresh lines to start from.
        key={`${revision.id}:${revision.updatedAt}:${revision.options.map((option) => option.id).join(",")}`}
        revision={revision}
        costShown={quote.costShown}
        canEdit={canEdit}
        lockNote={lockNote}
        initialOptionKey={single(search.option)}
      >
        <ApprovalBar
          revisionId={revision.id}
          status={revision.status}
          nextRevisionName={revisionName(quote.quoteNo, latestRev + 1)}
          isOwner={isOwner}
          isApprover={canApproveQuote(me.jobRole)}
          isLatest={revision.rev === latestRev}
          readiness={readiness}
          options={revision.options.map(({ id, key, label }) => ({
            id,
            key,
            label,
          }))}
          chosenOptionId={revision.chosenOptionId}
        />
      </QuoteEditor>
      <EnquiryPanel
        me={me}
        quote={{
          quoteNo: quote.quoteNo,
          salespersonId: quote.salespersonId,
          isOwner,
        }}
      />
      <section aria-label="History" className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-semibold">History</h2>
        <ol className="flex flex-col gap-1.5 text-sm">
          {[...revision.history].reverse().map((entry) => (
            <li key={`${entry.at}:${entry.action}`}>
              <span className="font-medium">{HISTORY_TEXT[entry.action]}</span>
              <span className="text-muted-foreground">
                {" "}
                · {entry.byName} ·{" "}
                <span className="font-mono tabular-nums">
                  {formatDateTime(entry.at)}
                </span>
              </span>
              {entry.note && (
                <p className="text-muted-foreground">{entry.note}</p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
