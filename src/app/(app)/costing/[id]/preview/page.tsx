import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintLayout } from "@/components/app/print-layout";
import { requirePage } from "@/lib/auth/require-page";
import { cn } from "@/lib/utils";
import { toClientQuote } from "../../quote-client-view";
import { loadQuote } from "../../quote-data";
import { quoteTsv } from "../../quote-tsv";
import { CopyTsvButton } from "./copy-tsv-button";
import { QuoteSheet } from "./quote-sheet";

export const metadata: Metadata = { title: "Client quote" };

const single = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : null;

const tab =
  "rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted/50";

/**
 * The quote as the customer gets it. Everything shown is built by toClientQuote, so cost, margin
 * and FOB never reach this page whatever the viewer's role.
 */
export default async function ClientQuotePage({
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

  const wanted = single(search.rev);
  const revision =
    quote.revisions.find((candidate) => String(candidate.rev) === wanted) ??
    quote.revisions.at(-1);
  if (!revision || revision.options.length === 0) notFound();

  const name =
    revision.rev > 0 ? `${quote.quoteNo}-R${revision.rev}` : quote.quoteNo;
  const client = toClientQuote(quote, revision, name);
  const many = client.options.length > 1;
  const chosen =
    client.options.find((option) => option.key === single(search.option)) ??
    client.options[0];
  const comparing = many && single(search.option) === null;
  const shown = comparing ? client.options : [chosen];
  const base = `/costing/${quote.id}/preview?rev=${revision.rev}`;

  return (
    <PrintLayout
      title="Quotation"
      toolbarTitle={`Client quote · ${name}`}
      meta={[
        { label: "Quote no.", value: name },
        { label: "Project", value: client.projectName || "–" },
        { label: "Salesperson", value: client.salespersonName },
      ]}
      toolbarActions={
        <>
          {many && (
            <nav aria-label="What to show" className="flex gap-2">
              <Link
                href={base}
                className={cn(tab, comparing && "border-primary bg-card")}
              >
                Compare {client.options.map((option) => option.key).join(" / ")}
              </Link>
              {client.options.map((option) => (
                <Link
                  key={option.key}
                  href={`${base}&option=${option.key}`}
                  className={cn(
                    tab,
                    !comparing && option === chosen && "border-primary bg-card",
                  )}
                >
                  Option {option.key} only
                </Link>
              ))}
            </nav>
          )}
          <CopyTsvButton tsv={quoteTsv(shown)} />
          <Link
            href={`/costing/${quote.id}?rev=${revision.rev}`}
            className={tab}
          >
            Back to costing
          </Link>
        </>
      }
    >
      <div className="mb-3">
        <div className="text-[10px] text-[#7a8691]">Bill to:</div>
        <div className="font-bold">{client.customerName || "–"}</div>
      </div>
      <QuoteSheet options={shown} />
    </PrintLayout>
  );
}
