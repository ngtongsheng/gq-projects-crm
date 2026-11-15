import type { StatusTone } from "@/components/app/status-badge";
import type { QuoteStatus } from "./quote-view";

// The demo's names: a confirmed costing is "OK to quote"; only a low one waits for approval.
export const QuoteStatusLabel: Record<QuoteStatus, string> = {
  draft: "Draft",
  submitted: "Below min margin · waiting",
  approved: "OK to quote",
  returned: "Returned",
};

export const QUOTE_STATUS_TONE: Record<QuoteStatus, StatusTone> = {
  draft: "neutral",
  submitted: "warn",
  approved: "good",
  returned: "bad",
};
