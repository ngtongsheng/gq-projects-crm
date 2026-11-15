import { z } from "zod";

// Anything unrecognised falls back to the board with everyone's projects.
const filterParams = z.object({
  person: z.uuid().optional().catch(undefined),
  view: z.enum(["board", "list"]).catch("board"),
});
export type PipelineFilters = z.infer<typeof filterParams>;

export function parsePipelineFilters(
  params: Record<string, string | string[] | undefined>,
): PipelineFilters {
  return filterParams.parse({ person: params.person, view: params.view });
}

/** A person is on a project as its PIC or its supporting salesperson. */
export function filterByPerson<
  Row extends { picId: string; supportId: string | null },
>(rows: Row[], person: string | undefined): Row[] {
  if (!person) return rows;
  return rows.filter((row) => row.picId === person || row.supportId === person);
}

/** The Person filter offers only people on the projects I can read (demo: TF()). */
export function peopleOnProjects<Member extends { id: string }>(
  members: readonly Member[],
  rows: readonly { picId: string; supportId: string | null }[],
): Member[] {
  const onProjects = new Set(
    rows.flatMap((row) =>
      row.supportId ? [row.picId, row.supportId] : [row.picId],
    ),
  );
  return members.filter((member) => onProjects.has(member.id));
}
