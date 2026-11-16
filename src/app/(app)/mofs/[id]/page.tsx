import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import {
  canEditRegister,
  canEditSite,
  canEnterPayments,
  canScheduleJobs,
  canSeeInstallerClaims,
} from "@/lib/auth/job-role";
import { seesMofCost } from "@/lib/auth/page-access";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { missingDeliveryChecks } from "@/lib/domain/delivery-status";
import { formatMobile } from "@/lib/domain/mobile";
import { totalAreaM2 } from "@/lib/domain/mof-totals";
import {
  SUPPLIER_PO_STATUSES,
  supplierPoReason,
} from "@/lib/domain/supplier-po";
import { todayMyt } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { getT } from "@/lib/i18n/server-t";
import { createClient } from "@/lib/supabase/server";
import { loadSiteSupervisors } from "../../installation/booking-data";
import {
  loadDeliveredEarlier,
  loadMofDoLines,
} from "../../installation/do-data";
import { loadInstallerChoices } from "../../installation/installer-data";
import { loadJobPeople } from "../../installation/job-people-data";
import { type MofDraft, MofForm } from "../mof-form";
import { LineUnitLabel } from "../schemas";
import { loadAwardedProjects } from "./awarded-projects";
import {
  ChangeHistory,
  MOF_CHANGE_COLUMNS,
  mofChangeRows,
} from "./change-history";
import { DeliveryJobs } from "./delivery-jobs";
import { InstallerClaims } from "./installer-claims";
import { loadInstallerPos } from "./installer-data";
import { loadJobs } from "./job-data";
import { blankDraft, blankIfNull, draftFromMof, mofRow } from "./mof-draft";
import { SupplierPos } from "./supplier-pos";
import { loadVariationOrders } from "./vo-data";
import { VoSheet } from "./vo-sheet";

export const metadata: Metadata = { title: "MOF" };

const NEW = "new";

const supplierPoRows = z.array(
  z.object({
    id: z.string(),
    zoho_no: z.string(),
    supplier: z.string(),
    po_date: z.string(),
    lead_time_days: z.number(),
    status: z.enum(SUPPLIER_PO_STATUSES),
    notes: z.string().nullable(),
  }),
);

const costRow = z.object({ cost: z.number() }).nullable();

function NewMof({
  draft,
  team,
  awardedProjects,
  showCost,
}: {
  draft: MofDraft;
  team: { id: string; name: string }[];
  awardedProjects: { id: string; name: string }[];
  showCost: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Register new MOF"
        description="Key in once the PO / LOA is received."
      />
      <MofForm
        key={draft.projectId}
        draft={draft}
        team={team}
        awardedProjects={awardedProjects}
        canEdit
        cost={showCost ? null : undefined}
      />
    </div>
  );
}

export default async function MofPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("mof");
  const t = await getT(me.language);
  const { id } = await params;
  const canEdit = canEditRegister(me.jobRole);
  const showCost = await seesMofCost(me);
  const supabase = await createClient();

  if (id === NEW) {
    if (!canEdit) redirect("/not-allowed");
    const { project } = await searchParams;
    const [team, awarded] = await Promise.all([
      getTeamDirectory(),
      loadAwardedProjects(supabase),
    ]);
    const source = awarded.find((row) => row.id === project);
    const draft = blankDraft();
    if (source) {
      Object.assign(draft, {
        projectId: source.id,
        salespersonId: source.pic_id,
        secondSalespersonId: blankIfNull(source.support_id),
        companyName: source.contacts.companies.name,
        projectName: source.name,
        customerName: source.contacts.name,
        customerMobile: formatMobile(source.contacts.mobile),
        contractSum: source.value > 0 ? source.value : null,
        commissionType: source.commission_type,
      } satisfies Partial<MofDraft>);
    }
    return (
      <NewMof
        draft={draft}
        team={team}
        awardedProjects={awarded.map((row) => ({
          id: row.id,
          name: `${row.name} · ${row.contacts.companies.name} · ${formatRm(row.value)}`,
        }))}
        showCost={showCost}
      />
    );
  }

  if (!z.uuid().safeParse(id).success) notFound();

  const [
    mofResult,
    changesResult,
    costResult,
    posResult,
    team,
    jobs,
    variationOrders,
    supervisors,
    jobPeople,
  ] = await Promise.all([
    supabase
      .from("mofs")
      .select(
        "id, mof_no, loa_date, salesperson_id, second_salesperson_id, project_id, company_name, project_name, loa_no, quote_no, site_address, site_contact_name, site_contact_mobile, office_pic_id, customer_contact, accounts_contact, customer_name, customer_mobile, accounts_name, accounts_mobile, accounts_email, scope, installer_name, contract_sum, vo_amount, retention_pct, invoice_no, invoice_date, commission_type, delivery_date, stage, latest_update, payment_checked, approvals_in_writing, artwork_signed_off, dos_pre_approved, updated_at, mof_lines(id, product, stock_type, supplier, qty, unit, area_m2, created_at)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("mof_changes")
      .select(MOF_CHANGE_COLUMNS)
      .eq("mof_id", id)
      .order("created_at", { ascending: false }),
    // Only managers ask; the database hides cost from everyone else anyway.
    showCost
      ? supabase.from("mof_costs").select("cost").eq("mof_id", id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("supplier_pos")
      .select("id, zoho_no, supplier, po_date, lead_time_days, status, notes")
      .eq("mof_id", id)
      .order("po_date"),
    getTeamDirectory(),
    loadJobs(supabase, id),
    loadVariationOrders(supabase, id, showCost),
    loadSiteSupervisors(),
    canScheduleJobs(me.jobRole) ? loadJobPeople() : Promise.resolve(undefined),
  ]);
  if (mofResult.error) {
    throw new Error(`Could not load MOF: ${mofResult.error.message}`);
  }
  if (!mofResult.data) notFound();
  if (changesResult.error) {
    throw new Error(
      `Could not load MOF change history: ${changesResult.error.message}`,
    );
  }
  if (costResult.error) {
    throw new Error(`Could not load MOF cost: ${costResult.error.message}`);
  }
  if (posResult.error) {
    throw new Error(`Could not load supplier POs: ${posResult.error.message}`);
  }
  const mof = mofRow.parse(mofResult.data);
  const pos = supplierPoRows.parse(posResult.data).map((po) => ({
    id: po.id,
    zohoNo: po.zoho_no,
    supplier: po.supplier,
    poDate: po.po_date,
    leadTimeDays: po.lead_time_days,
    status: po.status,
    notes: blankIfNull(po.notes),
  }));
  const poLines = mof.mof_lines.map((line) => ({
    stockType: line.stock_type,
    qty: line.qty,
    unit: line.unit,
    areaM2: line.area_m2,
  }));
  const supplierSuggestions = [
    ...new Set(
      mof.mof_lines.flatMap((line) => (line.supplier ? [line.supplier] : [])),
    ),
  ];
  const cost = costRow.parse(costResult.data);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const showInstallers = canSeeInstallerClaims(me.jobRole);
  const changes = mofChangeRows.parse(changesResult.data);
  const canSchedule = canScheduleJobs(me.jobRole);
  const [installerPos, installerChoices, doLines, earlierEntries] =
    await Promise.all([
      showInstallers
        ? loadInstallerPos(supabase, mof.id, nameOf)
        : Promise.resolve([]),
      showInstallers && canEdit ? loadInstallerChoices() : Promise.resolve([]),
      loadMofDoLines(supabase, mof.id),
      canSchedule
        ? Promise.all(
            jobs
              .filter((job) => job.jobType === "delivery")
              .map(
                async (job) =>
                  [
                    job.id,
                    await loadDeliveredEarlier(supabase, mof.id, job.id),
                  ] as const,
              ),
          )
        : Promise.resolve([]),
    ]);
  const earlierByJob = new Map(earlierEntries);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`MOF ${mof.mof_no}`}
        description={`${mof.project_name} · ${mof.company_name}`}
      />
      <MofForm
        key={mof.updated_at}
        draft={draftFromMof(mof)}
        team={team}
        awardedProjects={[]}
        canEdit={canEdit}
        cost={showCost ? (cost?.cost ?? null) : undefined}
        jobCompleted={variationOrders.jobCompleted}
      />
      <VoSheet
        mofId={mof.id}
        mofNo={mof.mof_no}
        contractSum={mof.contract_sum}
        vos={variationOrders.vos}
        canEdit={canEdit}
        showCost={showCost}
        jobCompleted={variationOrders.jobCompleted}
        supervisors={supervisors}
        jobSupervisorIds={[
          ...new Set(
            jobs.flatMap((job) =>
              job.siteSupervisorId ? [job.siteSupervisorId] : [],
            ),
          ),
        ]}
        today={todayMyt()}
      />
      <SupplierPos
        mofId={mof.id}
        mofNo={mof.mof_no}
        pos={pos}
        reason={supplierPoReason(poLines, totalAreaM2(poLines))}
        canEdit={canEdit}
        today={todayMyt()}
        supplierSuggestions={supplierSuggestions}
      />
      <DeliveryJobs
        t={t}
        mofId={mof.id}
        mofNo={mof.mof_no}
        jobs={jobs}
        team={team}
        people={jobPeople}
        defaultInstaller={blankIfNull(mof.installer_name)}
        missingChecks={missingDeliveryChecks({
          paymentChecked: mof.payment_checked,
          dosPreApproved: mof.dos_pre_approved,
        })}
        canSchedule={canSchedule}
        canCorrectDoNo={me.jobRole === "md"}
        doLines={doLines}
        earlierByJob={earlierByJob}
        ordered={mof.mof_lines.map((line) => ({
          product: line.product,
          qty: line.qty,
          unit: LineUnitLabel[line.unit],
        }))}
      />
      {showInstallers && (
        <InstallerClaims
          mofId={mof.id}
          pos={installerPos}
          mofInstaller={blankIfNull(mof.installer_name)}
          installers={installerChoices}
          canEdit={canEdit}
          canVerify={canEditSite(me.jobRole)}
          canPay={canEnterPayments(me.jobRole)}
          today={todayMyt()}
        />
      )}
      <ChangeHistory rows={changes} nameOf={nameOf} />
    </div>
  );
}
