import type { StatusTone } from "@/components/app/status-badge";

// Values mirror the check constraints in the site_bookings migration.
export const BOOKING_PURPOSES = [
  "site_measurement",
  "site_inspection",
  "handover",
  "shooting",
  "meet_client",
  "others",
] as const;
export type BookingPurpose = (typeof BOOKING_PURPOSES)[number];

export const BOOKING_PURPOSE_LABEL: Record<BookingPurpose, string> = {
  site_measurement: "Site measurement",
  site_inspection: "Site inspection",
  handover: "Handover",
  shooting: "Photo / video shooting",
  meet_client: "Meet client on site",
  others: "Others",
};

export const BOOKING_STATUSES = ["requested", "confirmed", "declined"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  declined: "Declined",
};

export const BOOKING_STATUS_TONE: Record<BookingStatus, StatusTone> = {
  requested: "warn",
  confirmed: "good",
  declined: "neutral",
};

/** The time a booking starts when none is keyed in. */
export const DEFAULT_BOOKING_TIME = "10:00";
