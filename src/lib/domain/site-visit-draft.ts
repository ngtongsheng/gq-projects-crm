import {
  type FollowUpOwner,
  type SiteActivity,
  STOCK_RETURN_WAY_LABEL,
  type StockReturnWay,
} from "@/lib/domain/site-log";
import type { CalendarDate } from "@/lib/format/date";

/** What the Log work wizard offers, in the demo's order. "Others" is gone from the wizard. */
export const WIZARD_ACTIVITIES = [
  "inspection",
  "measurement",
  "delivery",
  "installation",
  "shooting",
  "handover",
  "touch_up",
  "stock_return",
] as const satisfies readonly SiteActivity[];
export type WizardActivity = (typeof WIZARD_ACTIVITIES)[number];

const NEEDS_MOF: readonly WizardActivity[] = [
  "delivery",
  "installation",
  "handover",
  "touch_up",
  "stock_return",
];

/** A site with no MOF yet can only be inspected, measured or shot. */
export const needsMof = (activity: WizardActivity): boolean =>
  NEEDS_MOF.includes(activity);

// Jobs that end with leftover boxes, rolls or offcuts: ask about balance stock.
const ASKS_BALANCE_STOCK: readonly WizardActivity[] = [
  "installation",
  "handover",
  "touch_up",
  "stock_return",
];

export const RETURN_UNITS = [
  "box",
  "m²",
  "roll",
  "pcs",
  "pail",
  "bag",
] as const;

/** The follow-up owners the wizard offers, as the kind of problem each one fixes. */
export const PROBLEM_OWNERS = [
  "client",
  "salesperson",
  "purchasing",
  "installation_team",
] as const satisfies readonly FollowUpOwner[];
export type ProblemOwner = (typeof PROBLEM_OWNERS)[number];

export const PROBLEM_KIND_LABEL: Record<ProblemOwner, string> = {
  client: "Client to confirm / help",
  salesperson: "Additional charge",
  purchasing: "Material / delivery",
  installation_team: "Installer to fix",
};

/** Who chases it, shown under the kind. */
export const PROBLEM_CHASED_BY: Record<ProblemOwner, string> = {
  client: "You follow up",
  salesperson: "Salesperson follows up",
  purchasing: "Purchasing follows up",
  installation_team: "You follow up",
};

/** `id` only keeps the rows apart while they are edited; it is never saved. */
export type ReturnItemDraft = {
  id: string;
  item: string;
  qty: string;
  unit: string;
};

export type VisitDraft = {
  mofId: string | null;
  /** New site: the typed-in name, the salesperson who asked, and the pipeline project if any. */
  siteName: string;
  salespersonId: string | null;
  projectId: string | null;
  activities: WizardActivity[];
  installedPct: number | null;
  measurementSent: boolean | null;
  photosPosted: boolean | null;
  completedPhotosPosted: boolean | null;
  handoverSigned: boolean | null;
  deliveryOk: boolean | null;
  anyBalanceStock: boolean | null;
  returnItems: ReturnItemDraft[];
  returnWay: StockReturnWay | null;
  hasProblem: boolean | null;
  problemOwner: ProblemOwner | null;
  problemAction: string;
  problemDueOn: CalendarDate | null;
  note: string;
};

export const emptyReturnItem = (): ReturnItemDraft => ({
  id: crypto.randomUUID(),
  item: "",
  qty: "",
  unit: RETURN_UNITS[0],
});

export const emptyDraft = (): VisitDraft => ({
  mofId: null,
  siteName: "",
  salespersonId: null,
  projectId: null,
  activities: [],
  installedPct: null,
  measurementSent: null,
  photosPosted: null,
  completedPhotosPosted: null,
  handoverSigned: null,
  deliveryOk: null,
  anyBalanceStock: null,
  returnItems: [emptyReturnItem()],
  returnWay: null,
  hasProblem: null,
  problemOwner: null,
  problemAction: "",
  problemDueOn: null,
  note: "",
});

const did = (draft: VisitDraft, activity: WizardActivity) =>
  draft.activities.includes(activity);

/** Balance stock is only asked for a job with a MOF, after work that leaves offcuts behind. */
export const asksBalanceStock = (draft: VisitDraft): boolean =>
  draft.mofId !== null &&
  draft.activities.some((activity) => ASKS_BALANCE_STOCK.includes(activity));

/** A stock return always lists what went back; otherwise only when they say there is some. */
export const listsBalanceStock = (draft: VisitDraft): boolean =>
  asksBalanceStock(draft) &&
  (did(draft, "stock_return") || draft.anyBalanceStock === true);

export type BalanceStockItem = { qty: number; unit: string; item: string };

/** The rows they filled in; a blank row is ignored. */
export function balanceStockItems(draft: VisitDraft): BalanceStockItem[] {
  return draft.returnItems
    .filter((row) => row.item.trim() !== "")
    .map((row) => ({
      qty: Number(row.qty),
      unit: row.unit,
      item: row.item.trim(),
    }));
}

const MAX_ANSWER = 500;
const MAX_ITEM = 120;

/** The answer saved on the visit, e.g. "Balance stock: 5 box Grey tile (Installer brings back)". */
export function balanceStockAnswer(draft: VisitDraft): string | null {
  if (!asksBalanceStock(draft)) return null;
  if (!listsBalanceStock(draft)) return "No balance stock";
  const items = balanceStockItems(draft)
    .map((row) => `${row.qty} ${row.unit} ${row.item}`)
    .join(", ");
  const way = draft.returnWay
    ? ` (${STOCK_RETURN_WAY_LABEL[draft.returnWay]})`
    : "";
  const label = did(draft, "stock_return") ? "Stock return" : "Balance stock";
  return `${label}: ${items}${way}`;
}

/**
 * The first thing missing from the "what happened" step, in words the supervisor can act on, or
 * null when it can be saved. The server checks the same answers again.
 */
export function detailsProblem(draft: VisitDraft): string | null {
  if (did(draft, "installation") && draft.installedPct === null) {
    return "Choose how much of the whole job is installed.";
  }
  if (did(draft, "measurement") && draft.measurementSent === null) {
    return "Say whether the measurement went to the salesperson.";
  }
  if (did(draft, "shooting") && draft.photosPosted === null) {
    return "Say whether the photos are posted in the job WhatsApp group.";
  }
  if (did(draft, "delivery") && draft.deliveryOk === null) {
    return "Say whether the delivery arrived fine.";
  }
  if (did(draft, "handover")) {
    if (draft.handoverSigned === null) {
      return "Say whether the handover form is signed.";
    }
    if (draft.completedPhotosPosted === null) {
      return "Say whether the completed photos are posted.";
    }
  }
  if (asksBalanceStock(draft)) {
    if (!did(draft, "stock_return") && draft.anyBalanceStock === null) {
      return "Say whether there is balance stock left on site.";
    }
    if (listsBalanceStock(draft)) {
      const items = balanceStockItems(draft);
      if (items.length === 0 || items.some((row) => !(row.qty > 0))) {
        return "Key in each balance stock item and quantity.";
      }
      if (items.some((row) => row.item.length > MAX_ITEM)) {
        return "Keep each balance stock item name short.";
      }
      if (!draft.returnWay) return "Choose how the balance stock will go back.";
      if ((balanceStockAnswer(draft) ?? "").length > MAX_ANSWER) {
        return "The balance stock list is too long. Keep the main items.";
      }
    }
  }
  if (draft.hasProblem === null) return "Say whether there is a problem.";
  if (draft.hasProblem) {
    if (!draft.problemOwner) return "Choose what kind of problem it is.";
    if (draft.problemAction.trim() === "") {
      return "Write the problem in one line.";
    }
    if (!draft.problemDueOn) return "Choose the follow-up date.";
  }
  return null;
}

/** What `saveSiteVisit` takes; only the answers for the activities that were ticked go in. */
export function visitInput(draft: VisitDraft, visitedOn: CalendarDate) {
  const onMof = draft.mofId !== null;
  const ticked = (activity: WizardActivity, answer: boolean | null) =>
    did(draft, activity) ? answer : null;
  return {
    mofId: draft.mofId,
    siteName: onMof ? null : draft.siteName.trim(),
    salespersonId: onMof ? null : draft.salespersonId,
    projectId: onMof ? null : draft.projectId,
    visitedOn,
    activities: draft.activities,
    note: draft.note.trim() === "" ? null : draft.note.trim(),
    installedPct: did(draft, "installation") ? draft.installedPct : null,
    measurementSent: ticked("measurement", draft.measurementSent),
    photosPosted: ticked("shooting", draft.photosPosted),
    completedPhotosPosted: ticked("handover", draft.completedPhotosPosted),
    handoverSigned: ticked("handover", draft.handoverSigned),
    deliveryOk: ticked("delivery", draft.deliveryOk),
    returnAnswer: balanceStockAnswer(draft),
    followUp:
      draft.hasProblem && draft.problemOwner
        ? {
            action: draft.problemAction.trim(),
            ownerGroup: draft.problemOwner,
            dueOn: draft.problemDueOn,
          }
        : null,
  };
}
