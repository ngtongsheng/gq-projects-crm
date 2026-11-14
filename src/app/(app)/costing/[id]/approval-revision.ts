import { z } from "zod";
import { type Readiness, readiness } from "@/lib/domain/quote-status";
import type { createClient } from "@/lib/supabase/server";
import { loadMinMarginPct } from "../quote-data";
import {
  costingItemOf,
  ITEM_SELECT,
  QuoteStatus,
  quoteItemRow,
} from "../quote-view";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const revisionRow = z.object({
  id: z.string(),
  quote_id: z.string(),
  rev: z.number().int(),
  status: QuoteStatus,
  fx_usd: z.number(),
  fx_rmb: z.number(),
  sst_pct: z.number(),
  target_margin_pct: z.number(),
  quotes: z.object({
    quote_no: z.string(),
    salesperson_id: z.string(),
    quote_revisions: z.array(z.object({ rev: z.number().int() })),
  }),
  quote_options: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      label: z.string(),
      quote_items: z.array(quoteItemRow),
    }),
  ),
});

export type ApprovalRevision = {
  id: string;
  quoteId: string;
  quoteNo: string;
  salespersonId: string;
  rev: number;
  /** The quote's newest revision number. */
  latestRev: number;
  status: QuoteStatus;
  settings: {
    fx_usd: number;
    fx_rmb: number;
    sst_pct: number;
    target_margin_pct: number;
  };
  options: { id: string; key: string; label: string }[];
  readiness: Readiness;
};

/**
 * The revision as the approval flow needs it, with its readiness worked out from the stored cost
 * columns whoever asks: the check must not depend on the viewer's margin flag (loop 13 D3), and
 * it says only whether approval is needed, never a figure. Null when it does not exist or the
 * person cannot read it.
 */
export async function loadApprovalRevision(
  supabase: Supabase,
  revisionId: string,
): Promise<ApprovalRevision | null> {
  const [result, minMarginPct] = await Promise.all([
    supabase
      .from("quote_revisions")
      .select(
        `id, quote_id, rev, status, fx_usd, fx_rmb, sst_pct, target_margin_pct,
        quotes(quote_no, salesperson_id, quote_revisions(rev)),
        quote_options(id, key, label, quote_items(${ITEM_SELECT}))`,
      )
      .eq("id", revisionId)
      .maybeSingle(),
    loadMinMarginPct(supabase),
  ]);
  if (result.error) {
    throw new Error(`Could not load the revision: ${result.error.message}`);
  }
  if (!result.data) return null;
  const row = revisionRow.parse(result.data);
  const options = [...row.quote_options].sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  return {
    id: row.id,
    quoteId: row.quote_id,
    quoteNo: row.quotes.quote_no,
    salespersonId: row.quotes.salesperson_id,
    rev: row.rev,
    latestRev: Math.max(...row.quotes.quote_revisions.map((r) => r.rev)),
    status: row.status,
    settings: {
      fx_usd: row.fx_usd,
      fx_rmb: row.fx_rmb,
      sst_pct: row.sst_pct,
      target_margin_pct: row.target_margin_pct,
    },
    options: options.map(({ id, key, label }) => ({ id, key, label })),
    readiness: readiness(
      options.map((option) => ({
        key: option.key,
        items: option.quote_items.map(costingItemOf),
      })),
      minMarginPct,
    ),
  };
}
