import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { JobRole } from "@/lib/auth/job-role";

const migrationsDir = new URL("../migrations/", import.meta.url);
const bootstrapFile = new URL("./bootstrap.sql", import.meta.url);

export type TestDatabase = {
  db: PGlite;
  /** One signed-up person per job role; the MD is also the admin. */
  profileIds: Record<JobRole, string>;
  /** Act as the person with this job role through the API, or as the service role (no signed-in user) with null. */
  actAs: (jobRole: JobRole | null) => Promise<void>;
  close: () => Promise<void>;
};

/** A fresh in-memory database with every migration applied. Create one per test file: it takes about a second. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const db = await PGlite.create();
  await db.exec(await readFile(bootstrapFile, "utf8"));

  const migrations = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of migrations) {
    await db.exec(await readFile(new URL(name, migrationsDir), "utf8"));
  }

  const profileIds = await seedProfiles(db);

  const actAs = async (jobRole: JobRole | null) => {
    const sub = jobRole === null ? "" : profileIds[jobRole];
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      sub,
    ]);
    await db.exec(jobRole === null ? "reset role" : "set role authenticated");
  };

  return { db, profileIds, actAs, close: () => db.close() };
}

async function seedProfiles(db: PGlite): Promise<Record<JobRole, string>> {
  const entries = await Promise.all(
    JobRole.options.map(async (jobRole) => {
      const { rows } = await db.query<{ id: string }>(
        "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
        [`${jobRole}@test.local`, { full_name: `Test ${jobRole}` }],
      );
      const id = rows[0].id;
      await db.query(
        "update public.profiles set job_role = $1, role = $2 where id = $3",
        [jobRole, jobRole === "md" ? "admin" : "staff", id],
      );
      return [jobRole, id] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<JobRole, string>;
}
