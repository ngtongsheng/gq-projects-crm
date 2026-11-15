import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_REMINDERS,
  dailyLogReminderText,
  parseStoredReminders,
} from "./site-reminders";

const person = "11111111-1111-4111-8111-111111111111";

describe("parseStoredReminders", () => {
  it("falls back to the defaults when nothing is stored", () => {
    expect(parseStoredReminders(undefined)).toEqual(DEFAULT_SITE_REMINDERS);
    expect(parseStoredReminders("nonsense")).toEqual(DEFAULT_SITE_REMINDERS);
  });

  it("reads what was saved", () => {
    const saved = {
      dailyTime: "16:30",
      nextMorningTime: "08:45",
      missingListTo: [person],
      officeWhatsApp: "012-345 6789",
      supervisors: {
        [person]: {
          via: "both",
          whatsapp: "012",
          email: "a@b.co",
          language: "en",
        },
      },
    };
    expect(parseStoredReminders(saved)).toEqual(saved);
  });

  it("keeps the good fields when one is unreadable", () => {
    const result = parseStoredReminders({
      dailyTime: "late",
      nextMorningTime: "08:45",
      missingListTo: [person],
    });
    expect(result.dailyTime).toBe("17:00");
    expect(result.nextMorningTime).toBe("08:45");
    expect(result.missingListTo).toEqual([person]);
  });
});

describe("dailyLogReminderText", () => {
  it("is written in the supervisor's language", () => {
    expect(dailyLogReminderText("Ali", "en", "2026-11-11")).toContain(
      "you have not recorded today's site work (11 Nov 2026)",
    );
    expect(dailyLogReminderText("Ali", "bm", "2026-11-11")).toContain(
      "anda belum rekod kerja tapak hari ini (11 Nov 2026)",
    );
  });
});
