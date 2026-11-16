import { z } from "zod";
import {
  type DirectoryInstaller,
  tallyInstallerJobs,
} from "@/lib/domain/installer";
import { createClient } from "@/lib/supabase/server";

export type InstallerRow = DirectoryInstaller & {
  id: string;
  jobCount: number;
  /** Start of the latest job, or empty when there is none. */
  lastJobOn: string;
};

const installerRows = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    company: z.string().nullable(),
    phone: z.string().nullable(),
    phone2: z.string().nullable(),
    skills: z.array(z.string()),
    description: z.string().nullable(),
    area: z.string().nullable(),
    notes: z.string().nullable(),
    active: z.boolean(),
  }),
);

const jobDateRows = z.array(
  z.object({ installer_id: z.uuid(), scheduled_on: z.string() }),
);

// The API returns at most this many rows a call, so the jobs are read a page at a time.
const PAGE_SIZE = 1000;

async function loadInstallerJobDates() {
  const supabase = await createClient();
  const jobs: { installerId: string; scheduledOn: string }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("jobs")
      .select("installer_id, scheduled_on")
      .not("installer_id", "is", null)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load jobs: ${error.message}`);
    const page = jobDateRows.parse(data);
    jobs.push(
      ...page.map((job) => ({
        installerId: job.installer_id,
        scheduledOn: job.scheduled_on,
      })),
    );
    if (page.length < PAGE_SIZE) return jobs;
  }
}

/** Every installer in the directory, with how many jobs they have had and when the latest started. */
export async function loadInstallers(): Promise<InstallerRow[]> {
  const supabase = await createClient();
  const [installersResult, jobs] = await Promise.all([
    supabase
      .from("installers")
      .select(
        "id, name, company, phone, phone2, skills, description, area, notes, active",
      )
      .order("name"),
    loadInstallerJobDates(),
  ]);
  if (installersResult.error) {
    throw new Error(
      `Could not load installers: ${installersResult.error.message}`,
    );
  }
  const tally = tallyInstallerJobs(jobs);
  return installerRows.parse(installersResult.data).map((row) => ({
    id: row.id,
    name: row.name,
    company: row.company ?? "",
    phone: row.phone ?? "",
    phone2: row.phone2 ?? "",
    skills: row.skills,
    description: row.description ?? "",
    area: row.area ?? "",
    notes: row.notes ?? "",
    active: row.active,
    jobCount: tally.get(row.id)?.jobCount ?? 0,
    lastJobOn: tally.get(row.id)?.lastJobOn ?? "",
  }));
}

const choiceRows = z.array(
  z.object({ id: z.uuid(), name: z.string(), active: z.boolean() }),
);

/**
 * The installers the calendar's filter offers: the active ones, plus `selectedId` when that
 * installer has since been made inactive, so a link to their jobs still works.
 */
export async function loadInstallerChoices(
  selectedId?: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("installers")
    .select("id, name, active")
    .order("name");
  if (error) throw new Error(`Could not load installers: ${error.message}`);
  return choiceRows
    .parse(data)
    .filter((row) => row.active || row.id === selectedId)
    .map((row) => ({ id: row.id, name: row.name }));
}
