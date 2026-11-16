import { otHours } from "../../src/lib/domain/ot-hours.ts";
import { addDays } from "../../src/lib/format/date.ts";
import { projectId } from "./customers.ts";
import { at } from "./dates.ts";
import { exampleId } from "./ids.ts";
import { buildInstallationJobs } from "./installation.ts";
import { mofId } from "./orders.ts";
import type { PersonKey } from "./people.ts";
import type { BuildContext, ExampleTable, Row } from "./types.ts";

const jobId = (key: string) => exampleId("jobs", key);
const siteLogId = (key: string) => exampleId("site_logs", key);
const stockItemId = (key: string) => exampleId("stock_items", key);

export type Jobs = {
  tables: ExampleTable[];
  /** Delivery jobs that are Done; the database only accepts Done once the DO has its number. */
  deliveriesToFinish: string[];
};

export function buildJobs({ people, today }: BuildContext): Jobs {
  const seeds: Array<
    Row & { key: string; mof: string; offset: number; days: number }
  > = [
    {
      key: "j1",
      mof: "m1",
      job_type: "installation",
      status: "in_progress",
      offset: -5,
      days: 9,
      start_time: "09:00",
      installer: "Apex Installers",
      site_supervisor_id: people.awal,
      notes: "Ballroom first, then the foyer.",
    },
    {
      key: "j2",
      mof: "m1",
      job_type: "delivery",
      status: "done",
      offset: -12,
      days: 1,
      start_time: "08:00",
      installer: null,
      site_supervisor_id: people.awal,
      notes: null,
    },
    {
      key: "j3",
      mof: "m2",
      job_type: "delivery",
      status: "scheduled",
      offset: 10,
      days: 1,
      start_time: "09:30",
      installer: null,
      site_supervisor_id: people.awal,
      notes: "Lorry needs a tail lift.",
    },
    {
      key: "j4",
      mof: "m2",
      job_type: "site_measurement",
      status: "scheduled",
      offset: 2,
      days: 1,
      start_time: "10:00",
      installer: null,
      site_supervisor_id: people.awal,
      notes: null,
    },
    {
      key: "j5",
      mof: "m3",
      job_type: "site_measurement",
      status: "done",
      offset: -1,
      days: 1,
      start_time: "14:00",
      installer: null,
      site_supervisor_id: people.awal,
      notes: "Measurements sent to the office.",
    },
    {
      key: "j6",
      mof: "m4",
      job_type: "installation",
      status: "done",
      offset: -70,
      days: 5,
      start_time: "09:00",
      installer: "Apex Installers",
      site_supervisor_id: people.awal,
      notes: null,
    },
    {
      key: "j7",
      mof: "m6",
      job_type: "site_measurement",
      status: "scheduled",
      offset: 5,
      days: 1,
      start_time: "11:00",
      installer: null,
      site_supervisor_id: people.awal,
      notes: null,
    },
    {
      key: "j8",
      mof: "m7",
      job_type: "delivery",
      status: "postponed",
      offset: 20,
      days: 1,
      start_time: null,
      installer: null,
      site_supervisor_id: null,
      notes: "Site not ready.",
    },
    {
      key: "j9",
      mof: "m5",
      job_type: "installation",
      status: "done",
      offset: -175,
      days: 3,
      start_time: "09:00",
      installer: null,
      site_supervisor_id: people.awal,
      notes: null,
    },
  ];
  const jobs: Row[] = seeds.map(({ key, mof, offset, days, ...row }) => ({
    id: jobId(key),
    mof_id: mofId(mof),
    scheduled_on: addDays(today, offset),
    ends_on: addDays(today, offset + days - 1),
    ...row,
  }));
  const deliveriesToFinish = seeds
    .filter((s) => s.job_type === "delivery" && s.status === "done")
    .map((s) => jobId(s.key));
  const initialJobs = jobs.map((job) =>
    deliveriesToFinish.includes(String(job.id))
      ? { ...job, status: "scheduled" }
      : job,
  );

  const orderSeeds: Array<
    [
      string,
      string,
      string,
      string | null,
      string | null,
      number | null,
      boolean,
      boolean,
      string | null,
    ]
  > = [
    // key, job, mof, running no, transporter, delivered days ago, signed, final, items
    [
      "do1",
      "j2",
      "m1",
      "9201",
      "Swift Haul Logistics",
      12,
      true,
      true,
      "Carpet rolls 1180 m2, underlay",
    ],
    [
      "do2",
      "j3",
      "m2",
      null,
      "Swift Haul Logistics",
      null,
      false,
      false,
      "Carpet tiles 5400 sqft",
    ],
    ["do3", "j8", "m7", null, null, null, false, true, null],
  ];
  const orders: Row[] = orderSeeds.map(
    ([key, job, mof, runningNo, transporter, ago, signed, isFinal, items]) => ({
      id: exampleId("delivery_orders", key),
      mof_id: mofId(mof),
      job_id: jobId(job),
      running_no: runningNo,
      transporter,
      delivered_on: ago === null ? null : addDays(today, -ago),
      signed_returned: signed,
      is_final: isFinal,
      items,
    }),
  );

  const issued = buildInstallationJobs({ people, today });
  return {
    tables: [
      { table: "jobs", key: "id", rows: [...initialJobs, ...issued.jobs] },
      {
        table: "delivery_orders",
        key: "id",
        rows: [...orders, ...issued.orders],
      },
      ...issued.tables,
    ],
    deliveriesToFinish: [...deliveriesToFinish, ...issued.deliveriesToFinish],
  };
}

export function buildSiteBookings({
  people,
  today,
}: BuildContext): ExampleTable {
  const seeds: Row[] = [
    {
      key: "b1",
      requested_by: people.vernice,
      purpose: "site_measurement",
      project_id: projectId("kiara-hotel"),
      site: null,
      offset: 3,
      start_time: "10:00",
      notes: "Lobby measurement before the final quote.",
      status: "requested",
      decline_reason: null,
    },
    {
      key: "b2",
      requested_by: people.vicky,
      purpose: "handover",
      project_id: null,
      site: "Sutera Hospitality, Jalan Sutera",
      offset: 1,
      start_time: "15:00",
      notes: null,
      status: "confirmed",
      decline_reason: null,
    },
    {
      key: "b3",
      requested_by: people.vanessa,
      purpose: "shooting",
      project_id: null,
      site: "Rimba Residences Sales Gallery",
      offset: 6,
      start_time: "09:00",
      notes: "Photos for the case study.",
      status: "declined",
      decline_reason: "Already booked for the ballroom installation.",
    },
    {
      key: "b4",
      requested_by: people.eddie,
      purpose: "meet_client",
      project_id: projectId("harbour-studio"),
      site: null,
      offset: -4,
      start_time: "11:00",
      notes: null,
      status: "confirmed",
      decline_reason: null,
    },
  ];
  const rows: Row[] = seeds.map(({ key, offset, ...row }) => ({
    id: exampleId("site_bookings", String(key)),
    supervisor_id: people.awal,
    visit_on: addDays(today, Number(offset)),
    ...row,
  }));
  return { table: "site_bookings", key: "id", rows };
}

export const followUpId = (key: string) => exampleId("site_follow_ups", key);

type SiteLogSeed = Row & {
  key: string;
  /** Null for a new site logged before it has an MOF. */
  mof: string | null;
  ago: number;
  /** The supervisor; Awal unless said. */
  by?: PersonKey;
};

export function buildSiteWork({ people, today }: BuildContext): ExampleTable[] {
  const day = (ago: number) => addDays(today, -ago);
  const drive = (folder: string) =>
    `https://drive.example.com/folders/${folder}`;
  const logSeeds: SiteLogSeed[] = [
    {
      key: "l1",
      mof: "m1",
      ago: 3,
      activity: "installation",
      inst_pct: 60,
      notes: "Ballroom 60% done, no issues.",
      measurement_received: true,
      drive_link: drive("ballroom-progress"),
      handover_signed: false,
    },
    {
      key: "l2",
      mof: "m1",
      ago: 10,
      activity: "inspection",
      notes: "Subfloor level checked before laying.",
      measurement_received: true,
      drive_link: null,
      handover_signed: false,
    },
    {
      key: "l3",
      mof: "m3",
      ago: 1,
      activity: "measurement",
      notes: "Cafe area measured twice, matches the plan.",
      measurement_to: people.eddie,
      measurement_sent_on: day(1),
      measurement_received: true,
      measurement_received_at: at(today, -1, "17:00"),
      drive_link: drive("kiara-cafe"),
      handover_signed: false,
    },
    {
      key: "l4",
      mof: "m4",
      ago: 66,
      activity: "handover",
      notes: "Client walked the reception and signed.",
      measurement_received: true,
      photos_to: people.jess,
      photos_posted_on: day(66),
      photos_saved_at: at(today, -64, "10:00"),
      photos_saved_by: people.jess,
      return_answer: "No balance stock",
      drive_link: drive("reception-handover"),
      handover_signed: true,
    },
    {
      key: "l5",
      mof: "m2",
      ago: 20,
      activity: "measurement",
      notes: null,
      measurement_to: people.vernice,
      measurement_sent_on: day(20),
      measurement_received: false,
      drive_link: null,
      handover_signed: false,
    },
    // Loop 17: the activities the Log work wizard saves, with and without an MOF.
    {
      key: "l6",
      mof: "m1",
      ago: 12,
      activity: "delivery",
      delivery_ok: false,
      notes: "Two underlay rolls arrived wet.",
    },
    {
      key: "l7",
      mof: "m1",
      ago: 6,
      activity: "installation",
      inst_pct: 35,
      notes: "Ballroom stage left laid, foyer next.",
    },
    {
      key: "l8",
      mof: "m1",
      ago: 8,
      activity: "shooting",
      notes: "Feature wall and corridor, many photos.",
      photos_to: people.jess,
      photos_posted_on: day(8),
      photos_saved_at: at(today, -7, "11:30"),
      photos_saved_by: people.jess,
      drive_link: drive("ballroom-shoot"),
    },
    {
      key: "l9",
      mof: "m3",
      ago: 2,
      by: "akmal",
      activity: "shooting",
      notes: "Cafe finished, photos posted in the group.",
      photos_to: people.jess,
      photos_posted_on: day(2),
    },
    {
      key: "l10",
      mof: "m4",
      ago: 2,
      by: "akmal",
      activity: "stock_return",
      return_answer:
        "Stock return: 4 box Carpet tile Grey 50×50 (I bring it back myself)",
    },
    {
      key: "l11",
      mof: null,
      ago: 1,
      site_name: "Menara Hijau, Level 12",
      salesperson_id: people.vernice,
      activity: "inspection",
      notes: "Screed is uneven near the lift lobby.",
    },
    {
      key: "l12",
      mof: null,
      ago: 1,
      site_name: "Menara Hijau, Level 12",
      salesperson_id: people.vernice,
      activity: "measurement",
      notes: "Whole floor measured.",
      measurement_to: people.vernice,
      measurement_sent_on: day(1),
    },
    {
      key: "l13",
      mof: null,
      ago: 4,
      by: "akmal",
      site_name: "Kiara Hotel lobby",
      salesperson_id: people.vernice,
      project_id: projectId("kiara-hotel"),
      activity: "measurement",
      notes: "Lobby measured before the final quote.",
      measurement_to: people.vernice,
      measurement_sent_on: day(4),
    },
    {
      key: "l14",
      mof: "m2",
      ago: 0,
      by: "akmal",
      activity: "inspection",
      notes: "Loading bay checked before the delivery.",
      return_answer: "No balance stock",
    },
  ];
  const logs: Row[] = logSeeds.map(({ key, mof, ago, by, ...row }) => ({
    id: siteLogId(key),
    mof_id: mof === null ? null : mofId(mof),
    visited_on: day(ago),
    supervisor_id: people[by ?? "awal"],
    ...row,
  }));
  // Rows closed here carry the person and time directly; the app stamps them when a person closes one.
  const followUpSeeds: Array<
    Row & { key: string; log: string; due: number | null }
  > = [
    {
      key: "f1",
      log: "l1",
      action: "Order extra skirting for the foyer",
      owner_group: "purchasing",
      assignee_id: people.waimun,
      due: 4,
    },
    {
      key: "f2",
      log: "l1",
      action: "Confirm access to the ballroom on Saturday",
      owner_group: "client",
      assignee_id: people.awal,
      due: -1,
    },
    {
      key: "f3",
      log: "l3",
      action: "Send measurements to the mill",
      owner_group: "salesperson",
      assignee_id: people.eddie,
      due: 2,
    },
    {
      key: "f4",
      log: "l5",
      action: "Chase the missing measurement drawing",
      owner_group: "site_supervisor",
      assignee_id: null,
      due: null,
    },
    {
      key: "f5",
      log: "l6",
      action: "Reorder two underlay rolls that arrived wet",
      owner_group: "purchasing",
      assignee_id: people.waimun,
      due: 3,
    },
    {
      key: "f6",
      log: "l11",
      action: "Quote the screed levelling before laying",
      owner_group: "salesperson",
      assignee_id: people.vernice,
      due: 5,
    },
    {
      key: "f7",
      log: "l2",
      action: "Fix the lift key for the installers",
      owner_group: "installation_team",
      assignee_id: people.awal,
      due: -8,
      done_at: at(today, -9, "15:00"),
      done_by: people.awal,
    },
  ];
  const followUps: Row[] = followUpSeeds.map(({ key, log, due, ...row }) => ({
    id: followUpId(key),
    site_log_id: siteLogId(log),
    due_on: due === null ? null : addDays(today, due),
    ...row,
  }));
  return [
    { table: "site_logs", key: "id", rows: logs },
    { table: "site_follow_ups", key: "id", rows: followUps },
  ];
}

export function buildOtClaims({ people, today }: BuildContext): ExampleTable {
  type Seed = {
    key: string;
    person: keyof BuildContext["people"];
    ago: number;
    from: string;
    to: string;
    mof: string;
    reason: string;
    claimAs: "ot" | "replacement_leave";
    status: "pending" | "approved" | "rejected";
    approvedAs?: "ot" | "replacement_leave";
    decidedBy?: keyof BuildContext["people"];
  };
  const seeds: Seed[] = [
    {
      key: "o1",
      person: "awal",
      ago: 2,
      from: "18:00",
      to: "21:30",
      mof: "m1",
      reason: "Finish the ballroom section before the event.",
      claimAs: "ot",
      status: "pending",
    },
    {
      key: "o2",
      person: "awal",
      ago: 9,
      from: "17:30",
      to: "20:00",
      mof: "m1",
      reason: "Receive the late delivery.",
      claimAs: "ot",
      status: "approved",
      approvedAs: "ot",
      decidedBy: "vicky",
    },
    {
      key: "o3",
      person: "awal",
      ago: 25,
      from: "18:00",
      to: "22:00",
      mof: "m2",
      reason: "Weekend measurement with the developer.",
      claimAs: "ot",
      status: "approved",
      approvedAs: "replacement_leave",
      decidedBy: "eddie",
    },
    {
      key: "o4",
      person: "vernice",
      ago: 5,
      from: "19:00",
      to: "21:00",
      mof: "m6",
      reason: "Client meeting after office hours.",
      claimAs: "replacement_leave",
      status: "rejected",
      decidedBy: "vicky",
    },
    {
      key: "o5",
      person: "waimun",
      ago: 1,
      from: "17:30",
      to: "19:30",
      mof: "m3",
      reason: "Stock count before the shipment.",
      claimAs: "ot",
      status: "pending",
    },
  ];
  const rows: Row[] = seeds.map((s) => {
    const decided = s.decidedBy !== undefined;
    return {
      id: exampleId("ot_claims", s.key),
      profile_id: people[s.person],
      work_date: addDays(today, -s.ago),
      from_time: s.from,
      to_time: s.to,
      hours: otHours(s.from, s.to),
      mof_id: mofId(s.mof),
      reason: s.reason,
      claim_as: s.claimAs,
      status: s.status,
      approved_as: s.approvedAs ?? null,
      decided_by: s.decidedBy ? people[s.decidedBy] : null,
      decided_at: decided ? at(today, -s.ago + 1, "10:00") : null,
    };
  });
  return { table: "ot_claims", key: "id", rows };
}

export function buildStock({ people, today }: BuildContext): ExampleTable[] {
  const itemSeeds: Array<
    [string, string, string, string | null, number, string]
  > = [
    // key, sku, supplier, collection, qty, unit
    ["st1", "HCM-AXM-GARNET", "Halcyon Carpet Mills", "Axminster", 500, "m2"],
    ["st2", "HCM-TILE-SLATE", "Halcyon Carpet Mills", "Carpet Tile", 60, "box"],
    [
      "st3",
      "HCM-TILE-GRAPHITE",
      "Halcyon Carpet Mills",
      "Carpet Tile",
      45,
      "box",
    ],
    ["st4", "ORB-VPL-OAK", "Orbis Floors", "Vinyl Plank", 800, "sqft"],
    ["st5", "BLS-UNDERLAY-8", "Best Link Stock", null, 30, "roll"],
    ["st6", "ORB-VPL-ASH", "Orbis Floors", "Vinyl Plank", 0, "sqft"],
  ];
  const items: Row[] = itemSeeds.map(
    ([key, sku, supplier, collection, qty, unit]) => ({
      id: stockItemId(key),
      sku,
      supplier,
      collection,
      qty,
      unit,
    }),
  );
  const reservationSeeds: Array<
    [
      string,
      string,
      number,
      string,
      string,
      number | null,
      number | null,
      string | null,
    ]
  > = [
    // key, item, qty, project, status, reserved days ago, expires in days, note
    ["r1", "st1", 120, "kiara-hotel", "reserved", 10, 20, null],
    [
      "r2",
      "st1",
      80,
      "meridian-condo",
      "requested",
      null,
      null,
      "Needed for the lobby mock-up.",
    ],
    ["r3", "st2", 40, "rimba-unit", "po_issued", 25, 5, null],
    ["r4", "st4", 300, "kiara-cafe", "delivered", 40, -10, null],
    [
      "r5",
      "st3",
      20,
      "harbour-studio",
      "released",
      30,
      -2,
      "Client chose another colour.",
    ],
  ];
  const reservations: Row[] = reservationSeeds.map(
    ([key, item, qty, project, status, reservedAgo, expiresIn, note]) => ({
      id: exampleId("stock_reservations", key),
      item_id: stockItemId(item),
      qty,
      project_id: projectId(project),
      reserved_by: people.vernice,
      status,
      reserved_at: reservedAgo === null ? null : addDays(today, -reservedAgo),
      expires_on: expiresIn === null ? null : addDays(today, expiresIn),
      note,
    }),
  );
  return [
    { table: "stock_items", key: "id", rows: items },
    { table: "stock_reservations", key: "id", rows: reservations },
  ];
}
