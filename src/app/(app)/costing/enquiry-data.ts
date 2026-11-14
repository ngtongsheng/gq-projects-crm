import { z } from "zod";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { createClient } from "@/lib/supabase/server";
import {
  ENQUIRY_SELECT,
  EnquiryRow,
  type EnquiryView,
  toEnquiryView,
} from "./enquiry-view";

const DEFAULT_SST_PCT = 10;

const sstRows = z.array(z.object({ value: z.number() }));

/**
 * The FOB enquiries the viewer may read (the database decides: purchasing and the MD, Sales
 * Director and HR & Accounts read all, a salesperson only their own), optionally for one quote.
 */
export async function loadEnquiries(quoteNo?: string): Promise<EnquiryView[]> {
  const supabase = await createClient();
  const query = supabase.from("fob_enquiries").select(ENQUIRY_SELECT);
  const [result, sst, team] = await Promise.all([
    quoteNo ? query.eq("quote_no", quoteNo) : query,
    supabase.from("app_settings").select("value").eq("key", "costing_sst_pct"),
    getTeamDirectory(),
  ]);
  if (result.error) {
    throw new Error(`Could not load FOB enquiries: ${result.error.message}`);
  }
  if (sst.error) {
    throw new Error(`Could not load the SST setting: ${sst.error.message}`);
  }
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const context = {
    sstPct: sstRows.parse(sst.data)[0]?.value ?? DEFAULT_SST_PCT,
    personName: (id: string) => nameOf.get(id) ?? "Unnamed",
  };
  return z
    .array(EnquiryRow)
    .parse(result.data)
    .map((row) => toEnquiryView(row, context));
}
