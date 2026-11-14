import { z } from "zod";
import { seesMofCost } from "@/lib/auth/page-access";
import type { Viewer } from "@/lib/auth/pages";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { createClient } from "@/lib/supabase/server";
import {
  QUOTE_SELECT,
  type QuoteRegisterRow,
  QuoteRow,
  type QuoteView,
  type QuoteViewContext,
  toQuoteView,
  toRegisterRow,
} from "./quote-view";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const DEFAULT_MIN_MARGIN_PCT = 30;

const minMarginRows = z.array(z.object({ value: z.number() }));

async function loadMinMarginPct(supabase: Supabase): Promise<number> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "costing_min_margin_pct");
  if (error) {
    throw new Error(`Could not load the minimum margin: ${error.message}`);
  }
  return minMarginRows.parse(data)[0]?.value ?? DEFAULT_MIN_MARGIN_PCT;
}

/** How this viewer sees quotes. Cost and margin are decided here, on the server (loop 13 D3). */
async function viewContext(
  supabase: Supabase,
  viewer: Viewer,
): Promise<QuoteViewContext> {
  const [costShown, minMarginPct, team] = await Promise.all([
    seesMofCost(viewer),
    loadMinMarginPct(supabase),
    getTeamDirectory(),
  ]);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  return {
    costShown,
    minMarginPct,
    personName: (id) => nameOf.get(id) ?? "Unnamed",
  };
}

/** Every quote the viewer can read (the database decides which), most recently changed first. */
export async function loadQuoteRegister(
  viewer: Viewer,
): Promise<QuoteRegisterRow[]> {
  const supabase = await createClient();
  const [result, context] = await Promise.all([
    supabase.from("quotes").select(QUOTE_SELECT),
    viewContext(supabase, viewer),
  ]);
  if (result.error) {
    throw new Error(`Could not load quotes: ${result.error.message}`);
  }
  return z
    .array(QuoteRow)
    .parse(result.data)
    .map((row) => toRegisterRow(toQuoteView(row, context)))
    .filter((row) => row !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** One quote with every revision, or null when it does not exist or the viewer cannot read it. */
export async function loadQuote(
  viewer: Viewer,
  id: string,
): Promise<QuoteView | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const [result, context] = await Promise.all([
    supabase.from("quotes").select(QUOTE_SELECT).eq("id", id).maybeSingle(),
    viewContext(supabase, viewer),
  ]);
  if (result.error) {
    throw new Error(`Could not load the quote: ${result.error.message}`);
  }
  if (!result.data) return null;
  return toQuoteView(QuoteRow.parse(result.data), context);
}
