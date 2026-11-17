import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import {
  canBorrowCustomSample,
  isCustomSampleSeller,
  keepsCustomSamples,
} from "./custom-sample-access";
import {
  loadCustomerNames,
  loadCustomSamples,
  loadLoanDays,
  loadSellers,
} from "./custom-samples-data";
import { CustomSamplesList } from "./custom-samples-list";
import { RecordSampleDialog } from "./record-sample-dialog";

export const metadata: Metadata = { title: "Custom samples" };

/** Hand-tufted strike-off samples the office lends to salespeople (demo vTuft). */
export default async function CustomSamplesPage() {
  const me = await requirePage("tuft");
  const t = await getT(me.language);
  const canKeep = keepsCustomSamples(me.jobRole);
  const canBorrow = canBorrowCustomSample(me);
  // Only the MD lends for someone else; a seller borrows for themselves.
  const picksSeller = canBorrow && !isCustomSampleSeller(me);

  const [samples, team, loanDays, customers, sellers] = await Promise.all([
    loadCustomSamples(),
    getTeamDirectory(),
    loadLoanDays(),
    canBorrow ? loadCustomerNames() : [],
    picksSeller ? loadSellers() : null,
  ]);
  const suppliers = [
    ...new Set(samples.flatMap((sample) => sample.supplier ?? [])),
  ].sort();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("Custom samples")}
        description={`${t("Hand-tufted strike-off samples. The designer records each sample when it arrives from the supplier.")} ${t("Salespeople can borrow one for a client, then bring it back. Giving a sample away needs a reason.")} ${t("Loan period")}: ${loanDays} ${t("days")}.`}
        actions={canKeep && <RecordSampleDialog suppliers={suppliers} />}
      />
      <CustomSamplesList
        samples={samples}
        names={Object.fromEntries(
          team.map((member) => [member.id, member.name]),
        )}
        meId={me.id}
        meName={me.fullName ?? ""}
        today={todayMyt()}
        loanDays={loanDays}
        canKeep={canKeep}
        canBorrow={canBorrow}
        sellers={sellers}
        customers={customers}
      />
    </div>
  );
}
