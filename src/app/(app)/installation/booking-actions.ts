"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canAnswerBookings, canBookSiteSupervisor } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { isClockTime } from "@/lib/domain/ot-hours";
import { BOOKING_PURPOSES } from "@/lib/domain/site-booking";
import { createClient } from "@/lib/supabase/server";

export type BookingResult = { error: string | null };

const NOT_BOOKER =
  "Only sales, the MD, Sales Director or BD Director can book a site supervisor.";
const NOT_SUPERVISOR = "Only the booked site supervisor can answer a booking.";
const NOT_FOUND_BOOKING =
  "Could not find that booking, or it was already answered. Reload the page.";
const TRY_AGAIN = "Could not save the booking. Try again.";

const textField = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

const bookingForm = z
  .object({
    supervisorId: z.uuid({ error: "Choose the site supervisor." }),
    purpose: z.enum(BOOKING_PURPOSES, "Choose the purpose."),
    visitOn: z.iso.date("Choose the date."),
    startTime: z.string().refine(isClockTime, "Enter the time as HH:MM."),
    projectId: z
      .union([
        z.literal(""),
        z.uuid({ error: "Could not find that project. Reload the page." }),
      ])
      .transform((value) => (value === "" ? null : value)),
    site: optionalText(200, "Keep the site under 200 characters."),
    notes: optionalText(300, "Keep the note under 300 characters."),
  })
  .refine((booking) => booking.projectId !== null || booking.site !== null, {
    message: "Choose a project or type the site.",
    path: ["site"],
  });

const answerSchema = z.object({
  bookingId: z.uuid({ error: NOT_FOUND_BOOKING }),
  decision: z.enum(["confirmed", "declined"], "Confirm or decline."),
  reason: optionalText(300, "Keep the reason under 300 characters."),
});

/** Maps a database refusal to a message she can act on, or null when it is something else. */
function refusal(error: { code?: string; message?: string }): string | null {
  if (error.code === "42501") return NOT_BOOKER;
  if (error.code === "23514" && error.message) {
    if (error.message.includes("Site Supervisor")) {
      return "You can only book a site supervisor.";
    }
    if (error.message.includes("already been answered")) {
      return NOT_FOUND_BOOKING;
    }
  }
  if (error.code === "23503") {
    return "Could not find that project or person. Reload the page.";
  }
  return null;
}

/** Books a site supervisor. The booking starts Requested; the supervisor answers it. */
export async function requestBooking(
  formData: FormData,
): Promise<BookingResult> {
  const me = await requireSection("installation");
  if (!canBookSiteSupervisor(me.jobRole)) return { error: NOT_BOOKER };

  const parsed = bookingForm.safeParse({
    supervisorId: textField(formData, "supervisorId"),
    purpose: textField(formData, "purpose"),
    visitOn: textField(formData, "visitOn"),
    startTime: textField(formData, "startTime"),
    projectId: textField(formData, "projectId"),
    site: textField(formData, "site"),
    notes: textField(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const booking = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("site_bookings").insert({
    supervisor_id: booking.supervisorId,
    purpose: booking.purpose,
    visit_on: booking.visitOn,
    start_time: booking.startTime,
    project_id: booking.projectId,
    // A project already names the site, so the typed site only applies without one.
    site: booking.projectId ? null : booking.site,
    notes: booking.notes,
  });
  if (error) {
    const message = refusal(error);
    if (message) return { error: message };
    console.error("Could not save the booking", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/installation");
  return { error: null };
}

/**
 * The booked supervisor confirms or declines a request. A decline may carry a reason for
 * the person who booked. Someone else's booking is hidden from the update by the database,
 * so it simply is not found.
 */
export async function answerBooking(
  bookingId: string,
  decision: "confirmed" | "declined",
  reason: string,
): Promise<BookingResult> {
  const me = await requireSection("installation");
  if (!canAnswerBookings(me.jobRole)) return { error: NOT_SUPERVISOR };

  const parsed = answerSchema.safeParse({ bookingId, decision, reason });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const answer = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_bookings")
    .update({
      status: answer.decision,
      decline_reason: answer.decision === "declined" ? answer.reason : null,
    })
    .eq("id", answer.bookingId)
    .eq("supervisor_id", me.id)
    .eq("status", "requested")
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_SUPERVISOR };
    const message = refusal(error);
    if (message) return { error: message };
    console.error("Could not answer the booking", error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_FOUND_BOOKING };

  revalidatePath("/installation");
  return { error: null };
}
