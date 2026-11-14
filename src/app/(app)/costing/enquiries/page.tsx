import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canWorkEnquiries } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { todayMyt } from "@/lib/format/date";
import { loadEnquiries } from "../enquiry-data";
import { EnquiryDialog } from "../enquiry-dialog";
import { EnquiryTable } from "../enquiry-table";
import { searchEnquiries, splitEnquiries } from "../enquiry-view";

export const metadata: Metadata = { title: "FOB Enquiry" };

const REPLIED_LIMIT = 200;

const single = (value: string | string[] | undefined) =>
  typeof value === "string" ? value.slice(0, 100) : "";

export default async function FobEnquiryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("cost");

  if (!canWorkEnquiries(me.jobRole)) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="FOB Enquiry"
          description="Your enquiries are on your own costing, under FOB enquiries. Open the costing by its Quotation No."
        />
        <EmptyState
          title="Nothing to work here"
          description="Purchasing keeps the full list and replies to each enquiry."
          action={
            <Button asChild variant="outline">
              <Link href="/costing">Back to Costing Register</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const search = single((await searchParams).search);
  const [all, team] = await Promise.all([loadEnquiries(), getTeamDirectory()]);
  const { pending, replied } = splitEnquiries(searchEnquiries(all, search));
  const today = todayMyt();
  const table = (
    props: Pick<
      Parameters<typeof EnquiryTable>[0],
      "enquiries" | "emptyTitle" | "emptyDescription"
    >,
  ) => (
    <EnquiryTable
      {...props}
      showQuote
      canEdit
      canReply
      today={today}
      salespeople={team}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="FOB Enquiry"
        description="Sales ask for an FOB price on WhatsApp. Note it here, then fill in the FOB, rate and shipping when the supplier replies. The salesperson sees it on their own costing."
        actions={<EnquiryDialog today={today} canReply salespeople={team} />}
      />
      <form action="/costing/enquiries" className="flex items-center gap-2">
        <Input
          name="search"
          aria-label="Search"
          placeholder="Search product, supplier, quotation no."
          defaultValue={search}
          maxLength={100}
          className="w-full sm:w-80"
        />
        <Button type="submit" variant="outline">
          <Search data-icon="inline-start" />
          Filter
        </Button>
      </form>
      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold">
          Waiting for FOB ·{" "}
          <span className="font-mono tabular-nums">{pending.length}</span>
        </h2>
        {table({
          enquiries: pending,
          emptyTitle: "Nothing waiting",
          emptyDescription: "Every enquiry has a reply.",
        })}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold">
          Replied ·{" "}
          <span className="font-mono tabular-nums">{replied.length}</span>
        </h2>
        {table({
          enquiries: replied.slice(0, REPLIED_LIMIT),
          emptyTitle: "No replies yet",
          emptyDescription: "Replied enquiries appear here.",
        })}
      </section>
    </div>
  );
}
