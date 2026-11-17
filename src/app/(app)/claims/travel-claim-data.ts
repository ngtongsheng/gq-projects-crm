import { z } from "zod";
import type { JobRole } from "@/lib/auth/job-role";
import { reportKindFor } from "@/lib/domain/report-stats";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";

const TRAVEL_CLAIM_STATUSES = ["draft", "submitted", "released"] as const;
export type TravelClaimStatus = (typeof TRAVEL_CLAIM_STATUSES)[number];

const amount = z.coerce.number().nullable();

const travelClaimRow = z
  .object({
    status: z.enum(TRAVEL_CLAIM_STATUSES),
    petrol_parking_toll: amount,
    outstation: amount,
    hotel: amount,
    others: amount,
    others_description: z.string().nullable(),
    overtime: amount,
    remark: z.string().nullable(),
    submitted_on: z.iso.date().nullable(),
    final_amount: amount,
    final_note: z.string().nullable(),
    released_on: z.iso.date().nullable(),
  })
  .transform((row) => ({
    status: row.status,
    petrolParkingToll: row.petrol_parking_toll,
    outstation: row.outstation,
    hotel: row.hotel,
    others: row.others,
    othersDescription: row.others_description,
    overtime: row.overtime,
    remark: row.remark,
    submittedOn: row.submitted_on,
    finalAmount: row.final_amount,
    finalNote: row.final_note,
    releasedOn: row.released_on,
  }));
export type TravelClaim = z.output<typeof travelClaimRow>;

const COLUMNS =
  "status, petrol_parking_toll, outstation, hotel, others, others_description, overtime, remark, submitted_on, final_amount, final_note, released_on";

/** The person's claim for a claim month, or null when they have not started one. Row-level security limits it to their own. */
export async function loadTravelClaim(
  personId: string,
  month: CalendarDate,
): Promise<TravelClaim | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("travel_claims")
    .select(COLUMNS)
    .eq("profile_id", personId)
    .eq("month", month)
    .maybeSingle();
  if (error) throw new Error(`Could not load your claim: ${error.message}`);
  return data ? travelClaimRow.parse(data) : null;
}

const reportRow = z
  .object({ status: z.enum(["draft", "submitted", "reviewed", "approved"]) })
  .nullable();

/** The status of the person's monthly report for the claim month; null when none was started or their role files none. */
export async function loadMonthReportStatus(
  person: { id: string; jobRole: JobRole },
  month: CalendarDate,
) {
  if (!reportKindFor(person.jobRole)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("status")
    .eq("profile_id", person.id)
    .eq("month", month)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not load the monthly report: ${error.message}`);
  }
  return reportRow.parse(data)?.status ?? null;
}
