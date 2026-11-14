"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { requirePage } from "@/lib/auth/require-page";
import { startOfMonth } from "@/lib/domain/calendar-grid";
import {
  canReviewReport,
  HIGHLIGHT_ROWS,
  isLate,
  REPORT_KINDS,
  type ReportStats,
  reportKindFor,
} from "@/lib/domain/report-stats";
import { optionalText, textField } from "@/lib/form/form-fields";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import {
  loadLiveStats,
  loadReportSettings,
  type ReportSettings,
} from "./report-data";

export type ReportResult = { error: string | null; message?: string };

const MIN_HIGHLIGHTS = 3;

const NOT_A_FILER =
  "Only salespeople, the BD Director and Site Supervisors file monthly reports.";
const LOCKED = "This report is already submitted and can no longer be changed.";
const NOT_REVIEWER = "Only the MD or Sales Director can review reports.";
const NOT_FOUND_REPORT =
  "This report is not waiting for your review, or you cannot review it (only the MD reviews the BD Director's). Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

const reportForm = z.object({
  month: z.iso
    .date("Choose the month.")
    .refine((month) => month.endsWith("-01"), "Choose the month."),
  highlights: z.array(
    z.object({
      company: z
        .string()
        .trim()
        .max(120, "Keep each company under 120 characters."),
      achievement: z
        .string()
        .trim()
        .max(300, "Keep each highlight under 300 characters."),
    }),
  ),
  nextMonthPlan: optionalText(1000, "Keep the plan under 1000 characters."),
  supportNeeded: optionalText(
    1000,
    "Keep the support needed under 1000 characters.",
  ),
  passDownsConfirmed: z.boolean(),
});

function parseReportForm(formData: FormData) {
  return reportForm.safeParse({
    month: textField(formData, "month"),
    highlights: Array.from({ length: HIGHLIGHT_ROWS }, (_, row) => ({
      company: textField(formData, `highlightCompany${row}`),
      achievement: textField(formData, `highlightAchievement${row}`),
    })),
    nextMonthPlan: textField(formData, "nextMonthPlan"),
    supportNeeded: textField(formData, "supportNeeded"),
    passDownsConfirmed: formData.get("passDownsConfirmed") === "on",
  });
}

/** The BD Director files from Director Report; everyone else from Reports. */
async function requireFiler() {
  const me = await getCurrentProfile();
  return me?.jobRole === "bd"
    ? requirePage("drep")
    : requirePage("rep", "srep");
}

async function writeReport(
  formData: FormData,
  status: "draft" | "submitted",
): Promise<ReportResult> {
  const me = await requireFiler();
  const kind = reportKindFor(me.jobRole);
  if (!kind) return { error: NOT_A_FILER };

  const parsed = parseReportForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const form = parsed.data;
  if (form.month > startOfMonth(todayMyt())) {
    return {
      error: "You cannot file a report for a month that has not started.",
    };
  }
  const highlights = form.highlights.filter(
    (highlight) => highlight.achievement !== "",
  );

  if (status === "submitted") {
    if (kind !== "site" && highlights.length < MIN_HIGHLIGHTS) {
      return {
        error: `Fill in at least ${MIN_HIGHLIGHTS} highlights before submitting.`,
      };
    }
    if (kind === "bd" && !form.passDownsConfirmed) {
      return { error: "Tick the pass-down confirmation before submitting." };
    }
  }

  let settings: ReportSettings;
  let stats: ReportStats | null = null;
  try {
    settings = await loadReportSettings();
    // Frozen at submit so later changes to projects or the site log do not rewrite the report.
    if (status === "submitted") {
      stats = await loadLiveStats(kind, me.id, form.month, settings.targets);
    }
  } catch (error) {
    console.error("Could not read the figures for the monthly report", error);
    return { error: TRY_AGAIN };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .upsert(
      {
        month: form.month,
        status,
        stats,
        highlights,
        next_month_plan: form.nextMonthPlan,
        support_needed: form.supportNeeded,
        pass_downs_confirmed: kind === "bd" && form.passDownsConfirmed,
      },
      { onConflict: "profile_id,month" },
    )
    .select("submitted_at")
    .single();
  if (error) {
    // Row-level security refuses changes once the report has left draft.
    if (error.code === "42501") return { error: LOCKED };
    console.error("Could not save the monthly report", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/reports", "layout");
  if (status === "draft") return { error: null, message: "Draft saved." };
  const submittedAt = z.string().safeParse(data?.submitted_at);
  const late =
    submittedAt.success &&
    isLate(form.month, settings.dueTime, new Date(submittedAt.data));
  return {
    error: null,
    message: late ? "Report submitted late." : "Report submitted on time.",
  };
}

/** Saves the signed-in person's report for the month as a draft. */
export async function saveReportDraft(
  formData: FormData,
): Promise<ReportResult> {
  return writeReport(formData, "draft");
}

/** Submits the report with today's figures frozen into it. The database stamps the time. */
export async function submitReport(formData: FormData): Promise<ReportResult> {
  return writeReport(formData, "submitted");
}

const reviewForm = z.object({
  reportId: z.uuid({ error: NOT_FOUND_REPORT }),
  note: optionalText(500, "Keep the comment under 500 characters."),
});

/**
 * Marks a submitted report reviewed. The database checks again that the reviewer may review
 * this kind of report (only the MD for the BD Director's) and that it is not their own.
 */
export async function reviewReport(
  reportId: string,
  note: string,
): Promise<ReportResult> {
  const me = await requirePage("rep");
  if (me.jobRole !== "md" && me.jobRole !== "director") {
    return { error: NOT_REVIEWER };
  }

  const parsed = reviewForm.safeParse({ reportId, note });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .update({ status: "reviewed", review_note: parsed.data.note })
    .eq("id", parsed.data.reportId)
    .eq("status", "submitted")
    .in(
      "kind",
      REPORT_KINDS.filter((kind) => canReviewReport(me.jobRole, kind)),
    )
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_REVIEWER };
    console.error("Could not review the monthly report", error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_FOUND_REPORT };

  revalidatePath("/reports", "layout");
  return { error: null, message: "Marked as reviewed." };
}
