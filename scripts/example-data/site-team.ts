import { addDays } from "../../src/lib/format/date.ts";
import { at } from "./dates.ts";
import { exampleId } from "./ids.ts";
import { mofId } from "./orders.ts";
import { followUpId } from "./site.ts";
import type { BuildContext, ExampleTable, Row } from "./types.ts";

/** "Still waiting" notes on open follow-ups; the latest one's date is the follow-up's snooze. */
export function buildFollowUpWaits({
  people,
  today,
}: BuildContext): ExampleTable {
  const seeds: Array<{
    key: string;
    followUp: string;
    ago: number;
    note: string;
    snoozeIn: number;
    by: keyof BuildContext["people"];
  }> = [
    {
      key: "w1",
      followUp: "f2",
      ago: 3,
      note: "Client's site manager is away until Friday.",
      snoozeIn: -1,
      by: "awal",
    },
    {
      key: "w2",
      followUp: "f2",
      ago: 1,
      note: "Client says the guard will confirm on Monday.",
      snoozeIn: 2,
      by: "awal",
    },
    {
      key: "w3",
      followUp: "f1",
      ago: 0,
      note: "Supplier quoted four days for the skirting.",
      snoozeIn: 3,
      by: "waimun",
    },
  ];
  const rows: Row[] = seeds.map((seed) => ({
    id: exampleId("site_follow_up_waits", seed.key),
    follow_up_id: followUpId(seed.followUp),
    note: seed.note,
    snoozed_until: addDays(today, seed.snoozeIn),
    created_at: at(today, -seed.ago, "11:00"),
    created_by: people[seed.by],
  }));
  return { table: "site_follow_up_waits", key: "id", rows };
}

/** Office and other days away from site; leave and MC come from the leave examples. */
export function buildSiteOff({ people, today }: BuildContext): ExampleTable {
  const rows: Row[] = [
    {
      key: "o1",
      profile_id: people.awal,
      kind: "office",
      starts_on: addDays(today, -4),
      ends_on: addDays(today, -4),
      note: "Stock count at the warehouse.",
    },
    {
      key: "o2",
      profile_id: people.akmal,
      kind: "other",
      starts_on: addDays(today, -9),
      ends_on: addDays(today, -8),
      note: "Training day at the supplier.",
    },
    {
      key: "o3",
      profile_id: people.awal,
      kind: "other",
      starts_on: addDays(today, 3),
      ends_on: addDays(today, 3),
      note: null,
    },
  ].map(({ key, ...row }) => ({
    id: exampleId("site_off", key),
    created_by: row.profile_id,
    ...row,
  }));
  return { table: "site_off", key: "id", rows };
}

/** Requests for good photos or video: open, overdue, done and cancelled. */
export function buildShootRequests({
  people,
  today,
}: BuildContext): ExampleTable {
  const rows: Row[] = [
    {
      key: "s1",
      mof_id: mofId("m1"),
      kind: "photos_video",
      due_on: addDays(today, 7),
      best_on: addDays(today, 5),
      supervisor_id: people.awal,
      note: "Nice reception area, take the feature wall and corridor.",
      status: "requested",
      created_by: people.vanessa,
    },
    {
      key: "s2",
      mof_id: mofId("m4"),
      kind: "video",
      due_on: addDays(today, -1),
      best_on: null,
      supervisor_id: null,
      note: "Walk-through of the finished reception.",
      status: "requested",
      created_by: people.vernice,
    },
    {
      key: "s3",
      mof_id: mofId("m3"),
      kind: "photos",
      due_on: addDays(today, -5),
      best_on: null,
      supervisor_id: people.akmal,
      note: null,
      status: "done",
      done_at: at(today, -2, "16:00"),
      done_by: people.akmal,
      created_by: people.vicky,
    },
    {
      key: "s4",
      mof_id: mofId("m2"),
      kind: "photos",
      due_on: addDays(today, 10),
      best_on: null,
      supervisor_id: null,
      note: null,
      status: "cancelled",
      created_by: people.vernice,
    },
  ].map(({ key, ...row }) => ({
    id: exampleId("shoot_requests", key),
    ...row,
  }));
  return { table: "shoot_requests", key: "id", rows };
}
