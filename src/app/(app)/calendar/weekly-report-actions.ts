"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { dayOfWeek } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { mytWindow } from "./calendar-period";
import { filesWeeklyReport, outcomesWeek } from "./weekly-outcomes-data";

/** `late` is read back from the database, which stamps it against the week's deadline. */
export type SubmitWeeklyReportResult =
  | { error: string; late?: never }
  | { error: null; late: boolean };

export type ReviewWeeklyReportResult = { error: string | null };

const week = z.iso.date().refine((day) => dayOfWeek(day) === 1);
const optionalNote = z
  .string()
  .trim()
  .max(2000, "Keep it under 2000 characters.")
  .transform((value) => (value === "" ? null : value));

const submittedRow = z.object({ late: z.boolean() });
const UNIQUE_VIOLATION = "23505";
const WEEK_NOT_STARTED = "22023";

/**
 * The signed-in salesperson submits their report for the week starting on `monday`. Every
 * outcome of the week must be logged first; the database stamps the time and lateness.
 */
export async function submitWeeklyReport(
  monday: string,
  note: string,
): Promise<SubmitWeeklyReportResult> {
  const me = await requirePage("cal");
  if (!filesWeeklyReport(me.jobRole)) {
    return { error: "Only salespeople submit a weekly report." };
  }
  const parsedWeek = week.safeParse(monday);
  const parsedNote = optionalNote.safeParse(note);
  if (!parsedWeek.success) return { error: "Choose the week to submit." };
  if (!parsedNote.success) {
    return { error: parsedNote.error.issues[0]?.message ?? "Check the note." };
  }

  const supabase = await createClient();
  const window = mytWindow(
    parsedWeek.data,
    outcomesWeek(parsedWeek.data).sunday,
  );
  const { count, error: countError } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", me.id)
    .eq("status", "planned")
    .gte("starts_at", window.start)
    .lt("starts_at", window.end)
    .lte("starts_at", new Date().toISOString());
  if (countError) {
    console.error("Could not count unlogged outcomes", countError);
    return { error: "Could not submit the report. Try again." };
  }
  if (count) {
    return {
      error: `Log the outcome of ${count} visit${count === 1 ? "" : "s"} first.`,
    };
  }

  const { data, error } = await supabase
    .from("weekly_reports")
    .insert({ week: parsedWeek.data, note: parsedNote.data })
    .select("late")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "You already submitted the report for this week." };
    }
    if (error.code === WEEK_NOT_STARTED) {
      return { error: "This week has not started yet." };
    }
    console.error("Could not submit weekly report", error);
    return { error: "Could not submit the report. Try again." };
  }

  revalidatePath("/calendar");
  return { error: null, late: submittedRow.parse(data).late };
}

/** The MD or the writer's team lead marks a submitted report reviewed; the database decides who may. */
export async function reviewWeeklyReport(
  reportId: string,
  comment: string,
): Promise<ReviewWeeklyReportResult> {
  await requirePage("cal");
  const parsedId = z.uuid().safeParse(reportId);
  const parsedComment = optionalNote.safeParse(comment);
  if (!parsedId.success) {
    return { error: "Could not find that report. Reload the page." };
  }
  if (!parsedComment.success) {
    return {
      error: parsedComment.error.issues[0]?.message ?? "Check the comment.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_reports")
    .update({ status: "reviewed", review_note: parsedComment.data })
    .eq("id", parsedId.data)
    .eq("status", "submitted")
    .select("id");
  if (error) {
    console.error("Could not review weekly report", error);
    return { error: "Could not mark the report reviewed. Try again." };
  }
  if (data.length === 0) {
    return {
      error:
        "You can't review this report. Only the MD or the salesperson's team lead can, once it is submitted.",
    };
  }

  revalidatePath("/calendar");
  return { error: null };
}
