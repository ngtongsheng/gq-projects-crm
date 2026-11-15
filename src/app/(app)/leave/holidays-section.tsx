import { formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { AddHolidayDialog } from "./add-holiday-dialog";
import { HolidayPill } from "./holiday-pill";
import { LeaveSection } from "./leave-section";

export type Holiday = { day: string; name: string };

/** The demo's Public holidays panel; the Managing Director and HR & Accounts add and remove. */
export function HolidaysSection({
  holidays,
  year,
  today,
  canEdit,
  t,
}: {
  t: Translate;
  holidays: Holiday[];
  year: number;
  today: string;
  canEdit: boolean;
}) {
  const thisYear = holidays
    .filter((holiday) => holiday.day.startsWith(String(year)))
    .sort((a, b) => a.day.localeCompare(b.day));
  return (
    <LeaveSection
      title={`${t("Public holidays")} ${year}`}
      note={t(
        "Not counted as leave days. Leave already applied for keeps its day count.",
      )}
      action={canEdit ? <AddHolidayDialog today={today} /> : null}
    >
      {thisYear.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
          {t("No public holidays added yet.")}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {thisYear.map((holiday) => (
            <HolidayPill
              key={holiday.day}
              day={holiday.day}
              label={`${formatDate(holiday.day)} · ${holiday.name}`}
              canRemove={canEdit}
            />
          ))}
        </ul>
      )}
    </LeaveSection>
  );
}
