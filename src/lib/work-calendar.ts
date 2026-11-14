import { cache } from "react";
import { z } from "zod";
import type { WeekKind, WorkCalendar } from "@/lib/domain/workdays";
import { createClient } from "@/lib/supabase/server";

const holidayRows = z.array(z.object({ day: z.string() }));

// Cached per request: a page and its dashboards ask for several calendars but read the table once.
const loadHolidayDays = cache(async (): Promise<ReadonlySet<string>> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("public_holidays").select("day");
  if (error)
    throw new Error(`Could not load public holidays: ${error.message}`);
  return new Set(holidayRows.parse(data).map((row) => row.day));
});

/** The working days for a week pattern, with the company's public holidays left out. */
export async function loadWorkCalendar(week: WeekKind): Promise<WorkCalendar> {
  return { week, holidays: await loadHolidayDays() };
}
