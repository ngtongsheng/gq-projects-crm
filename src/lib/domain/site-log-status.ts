import type { StatusTone } from "@/components/app/status-badge";
import type { SiteActivity } from "@/lib/domain/site-log";
import type { CalendarDate } from "@/lib/format/date";

/**
 * Where a measurement or a set of photos has got to. `text` is a translatable phrase; the
 * person and day, when there are any, follow it.
 */
export type LogStatus = {
  text: string;
  who: string | null;
  on: CalendarDate | null;
  tone: StatusTone;
};

type MeasurementFacts = {
  to: string | null;
  sentOn: CalendarDate | null;
  received: boolean;
  receivedOn: CalendarDate | null;
};

/** A measurement goes to the salesperson, who taps Received (demo: measSt). */
export function measurementStatus(facts: MeasurementFacts): LogStatus {
  if (facts.received) {
    return {
      text: "Received by",
      who: facts.to,
      on: facts.receivedOn,
      tone: "good",
    };
  }
  if (facts.sentOn) {
    return {
      text: "Submitted to",
      who: facts.to,
      on: facts.sentOn,
      tone: "warn",
    };
  }
  return { text: "Not submitted yet", who: null, on: null, tone: "bad" };
}

type PhotosFacts = {
  activity: SiteActivity;
  to: string | null;
  postedOn: CalendarDate | null;
  savedBy: string | null;
  savedOn: CalendarDate | null;
};

/**
 * Shooting photos, or a handover's completed photos: posted in the job WhatsApp group, then
 * saved to Drive by sales support (demo: shotSt). Nothing is uploaded to the app.
 */
export function photosStatus(facts: PhotosFacts): LogStatus {
  if (facts.savedOn) {
    return {
      text: "Saved to Drive by",
      who: facts.savedBy,
      on: facts.savedOn,
      tone: "good",
    };
  }
  if (facts.postedOn) {
    return facts.to
      ? { text: "To save to Drive:", who: facts.to, on: null, tone: "warn" }
      : { text: "Posted, to save to Drive", who: null, on: null, tone: "warn" };
  }
  return {
    text:
      facts.activity === "handover"
        ? "Completed photos not posted yet"
        : "Not submitted yet",
    who: null,
    on: null,
    tone: "bad",
  };
}
