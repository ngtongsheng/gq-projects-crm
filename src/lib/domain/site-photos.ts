import { isManager, type JobRole } from "@/lib/auth/job-role";
import type { CalendarDate } from "@/lib/format/date";

// Values mirror the check constraints on shoot_requests.
export const SHOOT_KINDS = ["photos", "video", "photos_video"] as const;
export type ShootKind = (typeof SHOOT_KINDS)[number];

export const SHOOT_KIND_LABEL: Record<ShootKind, string> = {
  photos: "Many photos",
  video: "Video",
  photos_video: "Photos & video",
};

export const SHOOT_STATUSES = ["requested", "done", "cancelled"] as const;
export type ShootStatus = (typeof SHOOT_STATUSES)[number];

type Person = { id: string; jobRole: JobRole };

/** Asks for a shooting (SQL: the insert policy on shoot_requests). */
export const canRequestShoot = (jobRole: JobRole): boolean =>
  jobRole === "md" ||
  jobRole === "director" ||
  jobRole === "bd" ||
  jobRole === "sales" ||
  jobRole === "marketing";

/** The salesperson the measurement went to, or a manager (SQL: receive_measurement). */
export const canReceiveMeasurement = (
  me: Person,
  measurement: { toId: string | null },
): boolean => measurement.toId === me.id || isManager(me.jobRole);

/** The supervisor who logged the photos, or a manager (SQL: mark_photos_posted). */
export const canMarkPhotosPosted = (
  me: Person,
  photos: { supervisorId: string },
): boolean => photos.supervisorId === me.id || isManager(me.jobRole);

/** The person the photos went to, a manager, Purchasing or Sales support (SQL: save_photos_to_drive). */
export const canSaveToDrive = (
  me: Person,
  photos: { toId: string | null },
): boolean =>
  photos.toId === me.id ||
  isManager(me.jobRole) ||
  me.jobRole === "support" ||
  me.jobRole === "ssup";

/** Whoever asked, or a manager (SQL: the cancel policy on shoot_requests). */
export const canCancelShootRequest = (
  me: Person,
  request: { createdById: string },
): boolean => request.createdById === me.id || isManager(me.jobRole);

/** The demo only accepts a Google Drive or Docs address for the job's folder. */
export const isDriveFolderLink = (value: string): boolean =>
  /^https:\/\/(drive|docs)\.google\.com\//.test(value);

export type DueState = "overdue" | "today" | "later";

/** Where a shooting's due date stands against today. */
export const dueState = (dueOn: CalendarDate, today: CalendarDate): DueState =>
  dueOn < today ? "overdue" : dueOn === today ? "today" : "later";
