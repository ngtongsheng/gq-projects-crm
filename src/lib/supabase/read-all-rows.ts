// The API hands back at most this many rows a request (`max_rows` in supabase/config.toml) and
// says nothing when it stops there.
export const PAGE_SIZE = 1000;

type ReadError = { message: string };
type ReadResult = { data: unknown[] | null; error: ReadError | null };

/**
 * Every row a read matches, however many pages that takes. `read` builds the query for rows
 * `from` to `to`; when `stable` is true it must also order on a unique column (such as `id`) so
 * pages neither overlap nor skip rows. A read that fits one page runs exactly as before (no extra
 * order), so lines that tie keep the order they always had.
 */
export async function readAllRows(
  read: (from: number, to: number, stable: boolean) => PromiseLike<ReadResult>,
): Promise<
  { data: unknown[]; error: null } | { data: null; error: ReadError }
> {
  const first = await read(0, PAGE_SIZE - 1, false);
  if (first.error) return { data: null, error: first.error };
  const firstRows = first.data ?? [];
  if (firstRows.length < PAGE_SIZE) return { data: firstRows, error: null };

  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await read(from, from + PAGE_SIZE - 1, true);
    if (page.error) return { data: null, error: page.error };
    const pageRows = page.data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
