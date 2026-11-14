import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Profile } from "@/lib/auth/current-profile";
import { canRaiseEnquiry, canWorkEnquiries } from "@/lib/auth/job-role";
import { todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import { loadEnquiries } from "./enquiry-data";
import { EnquiryDialog } from "./enquiry-dialog";
import { EnquiryTable } from "./enquiry-table";

/**
 * The FOB enquiries of one costing, on its record. Salespeople see their own here, which is where
 * they read the landed cost Purchasing worked out before keying FOB, rate and shipping into a line.
 */
export async function EnquiryPanel({
  me,
  quote,
}: {
  me: Profile;
  quote: { quoteNo: string; salespersonId: string; isOwner: boolean };
}) {
  const t = await getT(me.language);
  const desk = canWorkEnquiries(me.jobRole);
  const canRaise = desk || (quote.isOwner && canRaiseEnquiry(me.jobRole));
  const enquiries = (await loadEnquiries(quote.quoteNo)).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  // Another salesperson's costing has none of the viewer's own enquiries to show.
  if (enquiries.length === 0 && !canRaise) return null;
  const today = todayMyt();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <CardTitle className="font-heading">{t("FOB enquiries")}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {t(
              "Ask Purchasing for an FOB price here. Their reply shows the landed cost to use in the costing above.",
            )}
          </span>
        </div>
        {canRaise && (
          <EnquiryDialog
            today={today}
            canReply={desk}
            salespeople={[]}
            quoteNo={quote.quoteNo}
            salespersonId={quote.salespersonId}
          />
        )}
      </CardHeader>
      <CardContent>
        <EnquiryTable
          enquiries={enquiries}
          showQuote={false}
          canEdit={canRaise}
          canReply={desk}
          today={today}
          salespeople={[]}
          t={t}
          emptyTitle={t("No enquiry yet")}
          emptyDescription={t(
            "Raise one when you need an FOB price from the supplier.",
          )}
        />
      </CardContent>
    </Card>
  );
}
