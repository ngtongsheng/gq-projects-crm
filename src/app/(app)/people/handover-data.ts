import { z } from "zod";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";

export type HandoverItem = {
  kind: "customer" | "project";
  name: string;
  fromId: string;
  toId: string;
  /** Malaysian calendar date, YYYY-MM-DD. */
  handedOverOn: string;
};

const named = z.object({ name: z.string() }).nullable();

const handoverRows = z.array(
  z.object({
    from_id: z.uuid(),
    to_id: z.uuid(),
    handed_over_at: z.string(),
    contact: named,
    project: named,
  }),
);

/** Every customer and project handed over when someone left, newest first. Only admins read it. */
export async function loadHandoverItems(): Promise<HandoverItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("handover_items")
    .select(
      "from_id, to_id, handed_over_at, contact:contacts(name), project:projects(name)",
    )
    .order("handed_over_at", { ascending: false });
  if (error) throw new Error(`Could not load handovers: ${error.message}`);
  return handoverRows.parse(data).map((row) => ({
    kind: row.project ? "project" : "customer",
    name: row.project?.name ?? row.contact?.name ?? "–",
    fromId: row.from_id,
    toId: row.to_id,
    handedOverOn: todayMyt(new Date(row.handed_over_at)),
  }));
}

export type HandoverEntry = {
  kind: HandoverItem["kind"];
  name: string;
  /** True when this person handed it over; false when they received it. */
  gave: boolean;
  otherName: string;
  handedOverOn: string;
};

/** One person's side of the handover list: what they gave and what they received. */
export function handoversOf(
  personId: string,
  items: readonly HandoverItem[],
  names: ReadonlyMap<string, string>,
): HandoverEntry[] {
  return items.flatMap((item) => {
    const gave = item.fromId === personId;
    if (!gave && item.toId !== personId) return [];
    return [
      {
        kind: item.kind,
        name: item.name,
        gave,
        otherName: names.get(gave ? item.toId : item.fromId) ?? "Unnamed",
        handedOverOn: item.handedOverOn,
      },
    ];
  });
}
