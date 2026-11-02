import type { StatusTone } from "@/components/app/status-badge";

/** The order's journey in sequence, then the two side stages. */
export const MOF_STAGES = [
  "pending_order",
  "ordered",
  "in_production",
  "shipping",
  "arrived_warehouse",
  "pending_delivery",
  "delivered_installing",
  "completed_payment_pending",
  "closed",
  "on_hold",
  "cancelled",
] as const;
export type MofStageKey = (typeof MOF_STAGES)[number];

export const MOF_STAGE_LABEL: Record<MofStageKey, string> = {
  pending_order: "Pending order",
  ordered: "Ordered",
  in_production: "In production",
  shipping: "Shipping",
  arrived_warehouse: "Arrived warehouse",
  pending_delivery: "Pending delivery",
  delivered_installing: "Delivered – installing",
  completed_payment_pending: "Completed – payment pending",
  closed: "Closed",
  on_hold: "On hold",
  cancelled: "Cancelled",
};

// Mirrors the prototype's regPill: delivered is amber, completed and closed green, side stages grey.
export const MOF_STAGE_TONE: Record<MofStageKey, StatusTone> = {
  pending_order: "info",
  ordered: "info",
  in_production: "info",
  shipping: "info",
  arrived_warehouse: "info",
  pending_delivery: "info",
  delivered_installing: "warn",
  completed_payment_pending: "good",
  closed: "good",
  on_hold: "neutral",
  cancelled: "neutral",
};

/** Closed and cancelled orders are finished; the register does not move them on. */
export const isFinalStage = (stage: MofStageKey): boolean =>
  stage === "closed" || stage === "cancelled";

/**
 * The stages an order can move to from the list. Any open stage can go to any other,
 * so on hold and cancelled are always reachable and a mistaken move can be undone.
 */
export function allowedMoves(from: MofStageKey): MofStageKey[] {
  if (isFinalStage(from)) return [];
  return MOF_STAGES.filter((stage) => stage !== from);
}

export const canMoveStage = (from: MofStageKey, to: MofStageKey): boolean =>
  allowedMoves(from).includes(to);

// The delivery has happened once an order reaches any of these.
const AFTER_DELIVERY: readonly MofStageKey[] = [
  "delivered_installing",
  "completed_payment_pending",
  "closed",
];

/**
 * A warning, not a block: leaving 'Pending delivery' for a stage after delivery
 * while "payment checked before delivery" is unticked.
 */
export function moveWarning(
  from: MofStageKey,
  to: MofStageKey,
  paymentChecked: boolean,
): string | null {
  if (from !== "pending_delivery" || paymentChecked) return null;
  if (!AFTER_DELIVERY.includes(to)) return null;
  return "Payment status was not checked before delivery. Tick it on the MOF, or confirm the pre-approval signed by VL.";
}
