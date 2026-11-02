import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const teamRows = z.array(
  z.object({ id: z.uuid(), full_name: z.string().nullable() }),
);

export type TeamMember = { id: string; name: string };

/** Everyone's id and name. Staff cannot read other profiles directly, so this goes through team_directory(). */
export async function getTeamDirectory(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("team_directory");
  if (error) throw new Error(`Could not load the team: ${error.message}`);
  return teamRows
    .parse(data)
    .map((row) => ({ id: row.id, name: row.full_name ?? "Unnamed" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
