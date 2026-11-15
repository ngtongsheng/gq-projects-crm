"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canChangeSettings } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import {
  SITE_REMINDERS_KEY,
  SiteReminderSettings,
} from "@/lib/domain/site-reminders";
import { textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import { loadSiteReminders } from "./site-reminder-data";

export type ReminderSettingsResult = { error: string | null };

const NOT_MD = "Only the MD or an admin can change the reminders.";
const TRY_AGAIN = "Could not save. Try again.";

const personIds = z.array(z.uuid({ error: "Reload the page and try again." }));

/**
 * Saves the daily log reminder settings for the Integration loop to send from. Nothing is sent
 * from here (loop 17 D4). The database lets only the MD and admins write app_settings.
 */
export async function saveSiteReminders(
  formData: FormData,
): Promise<ReminderSettingsResult> {
  const me = await requirePage("site");
  if (!canChangeSettings(me)) return { error: NOT_MD };

  const shown = personIds.safeParse(formData.getAll("supervisorId"));
  if (!shown.success) {
    return { error: shown.error.issues[0]?.message ?? "Check the details." };
  }
  // Only the supervisors on the form change; anyone not shown keeps what was saved.
  const saved = await loadSiteReminders();
  const supervisors: Record<string, unknown> = { ...saved.supervisors };
  for (const id of shown.data) {
    supervisors[id] = {
      via: textField(formData, `via-${id}`),
      whatsapp: textField(formData, `whatsapp-${id}`),
      email: textField(formData, `email-${id}`).trim(),
      language: textField(formData, `language-${id}`),
    };
  }

  const parsed = SiteReminderSettings.safeParse({
    dailyTime: textField(formData, "dailyTime"),
    nextMorningTime: textField(formData, "nextMorningTime"),
    missingListTo: formData.getAll("missingListTo"),
    officeWhatsApp: textField(formData, "officeWhatsApp"),
    supervisors,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { key: SITE_REMINDERS_KEY, value: parsed.data },
      { onConflict: "key" },
    );
  if (error) {
    if (error.code === "42501") return { error: NOT_MD };
    console.error("Could not save the reminder settings", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/site-work");
  return { error: null };
}
