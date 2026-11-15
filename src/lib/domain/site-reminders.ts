import { z } from "zod";
import { isClockTime } from "@/lib/format/clock-time";
import { type CalendarDate, formatDate } from "@/lib/format/date";

/** The app_settings row the daily log reminders are kept in. Nothing sends them yet (loop 17 D4). */
export const SITE_REMINDERS_KEY = "site_reminders";

export const REMINDER_CHANNELS = ["whatsapp", "email", "both"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const REMINDER_CHANNEL_LABEL: Record<ReminderChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  both: "Both",
};

export const REMINDER_LANGUAGES = ["en", "bm"] as const;
export type ReminderLanguage = (typeof REMINDER_LANGUAGES)[number];

export const REMINDER_LANGUAGE_LABEL: Record<ReminderLanguage, string> = {
  en: "English",
  bm: "BM",
};

const clockTime = z.string().refine(isClockTime, "Use a time like 17:00.");
const phone = z
  .string()
  .trim()
  .max(30, "Keep each number under 30 characters.");

const supervisorReminder = z.object({
  via: z.enum(REMINDER_CHANNELS, "Choose how to send the reminder."),
  whatsapp: phone,
  email: z.union([z.literal(""), z.email("Check the email address.").max(120)]),
  language: z.enum(REMINDER_LANGUAGES, "Choose a language."),
});
export type SupervisorReminder = z.infer<typeof supervisorReminder>;

export const DEFAULT_SUPERVISOR_REMINDER: SupervisorReminder = {
  via: "whatsapp",
  whatsapp: "",
  email: "",
  language: "bm",
};

/** Demo `db.remind`: the daily reminder, the next-morning list, and each supervisor's contact. */
export const SiteReminderSettings = z.object({
  dailyTime: clockTime,
  nextMorningTime: clockTime,
  /** Who gets the next morning's list of supervisors who did not log. */
  missingListTo: z.array(z.uuid()),
  officeWhatsApp: phone,
  supervisors: z.record(z.uuid(), supervisorReminder),
});
export type SiteReminderSettings = z.infer<typeof SiteReminderSettings>;

export const DEFAULT_SITE_REMINDERS: SiteReminderSettings = {
  dailyTime: "17:00",
  nextMorningTime: "09:00",
  missingListTo: [],
  officeWhatsApp: "",
  supervisors: {},
};

// One bad field falls back to its default, so a hand-edited row never blanks the whole page.
const stored = z.object({
  dailyTime: SiteReminderSettings.shape.dailyTime.catch(
    DEFAULT_SITE_REMINDERS.dailyTime,
  ),
  nextMorningTime: SiteReminderSettings.shape.nextMorningTime.catch(
    DEFAULT_SITE_REMINDERS.nextMorningTime,
  ),
  missingListTo: SiteReminderSettings.shape.missingListTo.catch([]),
  officeWhatsApp: SiteReminderSettings.shape.officeWhatsApp.catch(""),
  supervisors: SiteReminderSettings.shape.supervisors.catch({}),
});

/** The stored row as settings, with defaults for anything missing or unreadable. */
export const parseStoredReminders = (value: unknown): SiteReminderSettings =>
  stored.catch(DEFAULT_SITE_REMINDERS).parse(value);

/** The message a supervisor with no log gets at the reminder time (demo: remMsg). */
export function dailyLogReminderText(
  name: string,
  language: ReminderLanguage,
  day: CalendarDate,
): string {
  return language === "bm"
    ? `Salam ${name}, anda belum rekod kerja tapak hari ini (${formatDate(day)}). Sila buka GQP Office → Rekod kerja sebelum balik. Jika cuti / MC, sila rekod juga. Terima kasih.`
    : `Hi ${name}, you have not recorded today's site work (${formatDate(day)}). Please open GQP Office → Log work before you go home. If you are on leave or MC, record that too. Thank you.`;
}
