import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const linkRows = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    url: z.string(),
    note: z.string(),
  }),
);

export type FormLink = z.infer<typeof linkRows>[number];

/** The Drive links admins added, oldest first, as the demo lists them. */
export async function loadFormLinks(): Promise<FormLink[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_links")
    .select("id, name, url, note")
    .order("added_at", { ascending: true });
  if (error) throw new Error(`Could not load the form links: ${error.message}`);
  return linkRows.parse(data);
}
