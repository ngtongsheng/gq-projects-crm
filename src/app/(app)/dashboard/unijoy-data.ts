import { z } from "zod";
import {
  type UnijoyProgress,
  unijoyM2,
  unijoyProgress,
  unijoyTargetFor,
} from "@/lib/domain/unijoy";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { LineUnit } from "../mofs/schemas";

export const UNIJOY_SETTING = "unijoy_target_m2";

const mofRows = z.array(
  z.object({
    mof_lines: z.array(
      z.object({
        supplier: z.string().nullable(),
        qty: z.number(),
        unit: LineUnit,
        area_m2: z.number(),
      }),
    ),
  }),
);

export type UnijoyYear = {
  year: number;
  m2: number;
  /** Null when no target is set for the year. */
  target: number | null;
  progress: UnijoyProgress | null;
};

/**
 * Unijoy m² on the orders registered (by LOA date) in the year of `today`, and the yearly target
 * if one is set. Cancelled orders are left out; only product lines from Unijoy are counted.
 */
export async function loadUnijoyYear(today: CalendarDate): Promise<UnijoyYear> {
  const year = Number(today.slice(0, 4));
  const supabase = await createClient();
  const [mofs, setting] = await Promise.all([
    supabase
      .from("mofs")
      .select("mof_lines(supplier, qty, unit, area_m2)")
      .neq("stage", "cancelled")
      .gte("loa_date", `${year}-01-01`)
      .lt("loa_date", `${year + 1}-01-01`),
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", UNIJOY_SETTING)
      .maybeSingle(),
  ]);
  if (mofs.error) {
    throw new Error(`Could not load Unijoy orders: ${mofs.error.message}`);
  }
  if (setting.error) {
    throw new Error(
      `Could not load the Unijoy target: ${setting.error.message}`,
    );
  }

  const m2 = unijoyM2(
    mofRows.parse(mofs.data).flatMap((mof) =>
      mof.mof_lines.map((line) => ({
        supplier: line.supplier,
        qty: line.qty,
        unit: line.unit,
        areaM2: line.area_m2,
      })),
    ),
  );
  const target = unijoyTargetFor(setting.data?.value, year);
  return { year, m2, target, progress: unijoyProgress(m2, target) };
}
