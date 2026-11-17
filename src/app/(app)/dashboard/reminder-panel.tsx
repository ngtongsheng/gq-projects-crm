import Link from "next/link";
import { StatusBadge } from "@/components/app/status-badge";
import type { Profile } from "@/lib/auth/current-profile";
import { todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import { Panel } from "./dashboard-parts";
import { loadHomeReminders } from "./home-reminders-data";

/** Travel claims, custom samples and prepaid balances that need the person today; nothing is shown when none do. */
export async function ReminderPanel({ me }: { me: Profile }) {
  const t = await getT(me.language);
  const reminders = await loadHomeReminders(me, todayMyt(), t);
  if (reminders.length === 0) return null;
  return (
    <Panel title={t("Reminders")}>
      <ul className="divide-y">
        {reminders.map((reminder) => (
          <li key={reminder.key}>
            <Link
              href={reminder.href}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-sunk"
            >
              <StatusBadge tone={reminder.tone}>{reminder.count}</StatusBadge>
              <span className="min-w-0 flex-1">{reminder.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
