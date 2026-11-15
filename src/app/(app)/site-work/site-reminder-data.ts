import { z } from "zod";
import {
  parseStoredReminders,
  SITE_REMINDERS_KEY,
  type SiteReminderSettings,
} from "@/lib/domain/site-reminders";
import { createClient } from "@/lib/supabase/server";

/** The daily log reminder settings, or the defaults until a manager saves them. */
export async function loadSiteReminders(): Promise<SiteReminderSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SITE_REMINDERS_KEY)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not load the reminder settings: ${error.message}`);
  }
  return parseStoredReminders(
    data ? z.object({ value: z.unknown() }).parse(data).value : undefined,
  );
}
