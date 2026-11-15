import type { CalendarDate } from "@/lib/format/date";
import type { SiteActivity } from "./site-log";

/** The part of a site log that says anything about balance stock. */
export type StockReturnLog = {
  visitedOn: CalendarDate;
  supervisorId: string;
  activity: SiteActivity;
  mofId: string | null;
  mofNo: string | null;
  /** The MOF's project, or the site typed in for a new site. */
  siteLabel: string;
  returnAnswer: string | null;
};

export type StockReturnEntry = {
  key: string;
  visitedOn: CalendarDate;
  supervisorId: string;
  mofId: string | null;
  mofNo: string | null;
  siteLabel: string;
  /** True when the stock went back that day; false when it is still on site to be returned. */
  sentBack: boolean;
  /** What was keyed in, e.g. "5 box Grey tile (Installer brings back)". */
  items: string;
};

// The wizard saves "No balance stock", "Balance stock: ..." or "Stock return: ...".
const NO_STOCK = /^No balance stock/;
const LABEL = /^(Stock return|Balance stock):\s*/;

/**
 * The balance stock supervisors reported, newest first. A visit is one entry however many
 * activities it logged: the answer sits on its first log and the stock return on another.
 * There is no status table until loop 18, so this lists what was said, not where it went.
 */
export function stockReturnEntries(
  logs: readonly StockReturnLog[],
): StockReturnEntry[] {
  const visits = new Map<string, StockReturnEntry>();
  for (const log of logs) {
    const sentBack = log.activity === "stock_return";
    const answer =
      log.returnAnswer && !NO_STOCK.test(log.returnAnswer)
        ? log.returnAnswer.replace(LABEL, "")
        : null;
    if (!sentBack && answer === null) continue;

    const key = `${log.visitedOn}|${log.supervisorId}|${log.mofId ?? log.siteLabel.toLowerCase()}`;
    const entry = visits.get(key);
    if (entry) {
      entry.sentBack ||= sentBack;
      if (!entry.items && answer) entry.items = answer;
    } else {
      visits.set(key, {
        key,
        visitedOn: log.visitedOn,
        supervisorId: log.supervisorId,
        mofId: log.mofId,
        mofNo: log.mofNo,
        siteLabel: log.siteLabel,
        sentBack,
        items: answer ?? "",
      });
    }
  }
  return [...visits.values()].sort((a, b) =>
    b.visitedOn.localeCompare(a.visitedOn),
  );
}
