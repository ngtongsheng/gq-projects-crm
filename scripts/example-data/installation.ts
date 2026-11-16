import { addDays } from "../../src/lib/format/date.ts";
import { at } from "./dates.ts";
import { exampleId } from "./ids.ts";
import { mofId } from "./orders.ts";
import type { BuildContext, ExampleTable, Row } from "./types.ts";

const installerId = (key: string) => exampleId("installers", key);
const jobId = (key: string) => exampleId("jobs", key);
const orderId = (key: string) => exampleId("delivery_orders", key);

/**
 * The installer directory. Inserted before the jobs: a job that names an installer already in
 * the directory is linked to it, so "Apex Installers" on the older jobs does not add a second row.
 */
export function buildInstallers(): ExampleTable {
  const seeds: Row[] = [
    {
      key: "apex",
      name: "Apex Installers",
      company: "Apex Installers Sdn Bhd",
      phone: "012-3456780",
      phone2: "03-55123456",
      skills: ["Carpet tile", "Broadloom carpet", "Edging / trims"],
      description:
        "Carpet tile and broadloom for offices and hotels, own team of 8, can do night shift.",
      area: "Klang Valley",
      notes: "Rate RM 1.20 per sqft for tiles. Book two weeks ahead.",
    },
    {
      key: "delta",
      name: "Delta Floor Crew",
      company: null,
      phone: "016-7788990",
      phone2: null,
      skills: ["Vinyl tile / sheet", "SPC / laminate"],
      description: "Vinyl and SPC, small team of 3, good with stair nosing.",
      area: "Penang",
      notes: null,
    },
    {
      key: "rahman",
      name: "Rahman Timber Works",
      company: "Rahman Timber Works",
      phone: "019-2233445",
      phone2: "019-2233446",
      skills: ["Timber", "Sports flooring", "Epoxy / screeding"],
      description: null,
      area: "Johor Bahru, Melaka",
      notes: null,
    },
    {
      key: "old-hand",
      name: "Old Hand Carpets",
      company: null,
      phone: "013-5566778",
      phone2: null,
      skills: ["Carpet tile"],
      description: null,
      area: null,
      notes: "Stopped working with GQ.",
      active: false,
    },
  ];
  const rows: Row[] = seeds.map(({ key, ...row }) => ({
    id: installerId(String(key)),
    active: true,
    ...row,
  }));
  return { table: "installers", key: "id", rows };
}

export type InstallationJobs = {
  jobs: Row[];
  orders: Row[];
  /** Delivery jobs that are Done; their DO number has to exist first. */
  deliveriesToFinish: string[];
  /** The DO items and the voided number, which wait for their DO and job. */
  tables: ExampleTable[];
};

/**
 * Jobs and DOs the app issued numbers for. The app counts on from the highest number used or
 * voided, and the older example DO was keyed in from Zoho as 9201, so the app's numbers run
 * 9202, 9203 in the order they were issued. 9204 was issued and then voided when its delivery
 * was postponed, so the next one is 9205 and a voided number is never used again.
 */
export function buildInstallationJobs({
  people,
  today,
}: BuildContext): InstallationJobs {
  const seeds: Array<
    Row & { key: string; mof: string; offset: number; days: number }
  > = [
    {
      key: "j10",
      mof: "m3",
      job_type: "delivery",
      status: "done",
      offset: -3,
      days: 1,
      start_time: "09:00",
      site_supervisor_id: people.awal,
      notes: "Delivered to the loading bay.",
    },
    {
      key: "j11",
      mof: "m6",
      job_type: "delivery",
      status: "scheduled",
      offset: 4,
      days: 1,
      start_time: "10:00",
      site_supervisor_id: people.awal,
      notes: "Supplier delivers straight to site.",
    },
    {
      key: "j12",
      mof: "m6",
      job_type: "delivery",
      status: "postponed",
      offset: 9,
      days: 1,
      start_time: null,
      site_supervisor_id: null,
      notes: "Cancelled DO 9204: site not ready, to be rescheduled.",
    },
    {
      key: "j13",
      mof: "m5",
      job_type: "installation",
      status: "scheduled",
      offset: 6,
      days: 2,
      start_time: "08:30",
      installer_id: installerId("delta"),
      site_supervisor_id: people.akmal,
      notes: null,
    },
    {
      key: "j14",
      mof: "m2",
      job_type: "installation",
      status: "scheduled",
      offset: 12,
      days: 1,
      start_time: "14:00",
      supervisor_only: true,
      site_supervisor_id: people.sarah,
      notes: "Touch up by the supervisor only, no crew.",
    },
  ];
  const deliveriesToFinish = seeds
    .filter((s) => s.job_type === "delivery" && s.status === "done")
    .map((s) => jobId(s.key));
  const jobs: Row[] = seeds.map(({ key, mof, offset, days, ...row }) => {
    const job = {
      id: jobId(key),
      mof_id: mofId(mof),
      scheduled_on: addDays(today, offset),
      ends_on: addDays(today, offset + days - 1),
      ...row,
    };
    return deliveriesToFinish.includes(job.id)
      ? { ...job, status: "scheduled" }
      : job;
  });

  const orders: Row[] = [
    {
      id: orderId("do4"),
      mof_id: mofId("m3"),
      job_id: jobId("j10"),
      running_no: "9202",
      transporter: "Swift Haul Logistics",
      delivered_on: addDays(today, -3),
      signed_returned: false,
      is_final: false,
      do_date: addDays(today, -3),
      passed_to_supplier: false,
      issued_at: at(today, -5, "10:15"),
      issued_by: people.waimun,
    },
    {
      id: orderId("do5"),
      mof_id: mofId("m6"),
      job_id: jobId("j11"),
      running_no: "9203",
      transporter: "Lalamove",
      is_final: true,
      do_date: addDays(today, 4),
      passed_to_supplier: true,
      issued_at: at(today, -2, "16:40"),
      issued_by: people.waimun,
    },
    // The number 9204 was taken off this DO when the delivery was postponed.
    {
      id: orderId("do6"),
      mof_id: mofId("m6"),
      job_id: jobId("j12"),
      running_no: null,
      is_final: false,
    },
  ];

  const lineSeeds: Array<
    [string, number, string, string | null, string, number, string | null]
  > = [
    // order, position, product, code, unit, qty, covers
    [
      "do4",
      1,
      "Halcyon Carpet Tile Slate",
      "HCM-TILE-SLATE",
      "Box",
      40,
      "1550 sqft",
    ],
    ["do4", 2, "Underlay 8mm", null, "Roll", 12, null],
    ["do5", 1, "Orbis Vinyl Plank Oak", "ORB-VPL-OAK", "Box", 30, "900 sqft"],
    ["do5", 2, "Skirting trim 2.4m", null, "Pc", 60, null],
  ];
  const lines: Row[] = lineSeeds.map(
    ([order, position, product, code, unit, qty, covers]) => ({
      id: exampleId("delivery_order_lines", `${order}:${position}`),
      delivery_order_id: orderId(order),
      position,
      product,
      code,
      unit,
      qty,
      covers,
    }),
  );
  const voided: Row[] = [
    {
      running_no: "9204",
      mof_id: mofId("m6"),
      job_id: jobId("j12"),
      cancelled_at: at(today, -1, "17:30"),
      cancelled_by: people.waimun,
    },
  ];

  return {
    jobs,
    orders,
    deliveriesToFinish,
    tables: [
      {
        table: "delivery_order_lines",
        key: "id",
        rows: lines,
        clearedByParent: true,
      },
      {
        table: "cancelled_delivery_order_numbers",
        key: "mof_id",
        rows: voided,
        clearedByParent: true,
      },
    ],
  };
}
