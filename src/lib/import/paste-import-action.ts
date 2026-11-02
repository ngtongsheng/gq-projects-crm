import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  countActions,
  type DuplicateChoice,
  type ImportCounts,
  type ImportPlan,
  type ImportPreview,
} from "./import-plan";

export type Supabase = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string; message?: string };

export type PreviewImportResult = {
  error: string | null;
  preview: ImportPreview | null;
};

export type SaveImportResult = {
  error: string | null;
  counts: ImportCounts | null;
};

/** What one list needs to offer paste import; the server steps are the same for every list. */
export type PasteImportSpec<Context, Key extends string, Row> = {
  /** The paste dialog's kind for this list. */
  kind: string;
  allowed: boolean;
  /** Plain words for someone who may not import here, also used when the database refuses. */
  notAllowed: string;
  /** Everything already in the CRM that the paste is checked against; null when it could not be read. */
  load: (supabase: Supabase) => Promise<Context | null>;
  plan: (
    text: string,
    onDuplicate: DuplicateChoice,
    context: Context,
  ) => ImportPlan<Key, Row>;
  toPreview: (plan: ImportPlan<Key, Row>) => ImportPreview;
  /** Rows for the database function: only rows to add or update. */
  payload: (plan: ImportPlan<Key, Row>) => Record<string, unknown>[];
  /** The security-invoker database function that saves the rows in one transaction. */
  rpc: string;
  revalidate: readonly string[];
  /** Plain words for a database refusal this list knows about. */
  explain?: (error: DbError) => string | null;
};

export type PasteImportInput = {
  kind: string;
  text: string;
  onDuplicate: DuplicateChoice;
};

const UNIQUE_VIOLATION = "23505";
const NOT_PERMITTED = "42501";

function readRequest(kind: string, input: PasteImportInput) {
  return z
    .object({
      kind: z.literal(kind),
      text: z
        .string()
        .max(1_000_000, "That paste is too big. Paste fewer rows."),
      onDuplicate: z.enum(["skip", "update"]),
    })
    .safeParse(input);
}

/** Parses and checks a paste against the CRM without saving anything. */
export async function previewPasteImport<Context, Key extends string, Row>(
  spec: PasteImportSpec<Context, Key, Row>,
  input: PasteImportInput,
): Promise<PreviewImportResult> {
  if (!spec.allowed) return { error: spec.notAllowed, preview: null };
  const request = readRequest(spec.kind, input);
  if (!request.success) {
    return {
      error: request.error.issues[0]?.message ?? "Check the paste.",
      preview: null,
    };
  }
  const context = await spec.load(await createClient());
  if (!context) {
    return { error: "Could not check the rows. Try again.", preview: null };
  }
  const plan = spec.plan(request.data.text, request.data.onDuplicate, context);
  return { error: null, preview: spec.toPreview(plan) };
}

/**
 * Saves the valid rows of a paste through the signed-in person's own client, so row security
 * applies. The paste is parsed and checked again here against fresh data; nothing the
 * browser showed or sent is trusted.
 */
export async function savePasteImport<Context, Key extends string, Row>(
  spec: PasteImportSpec<Context, Key, Row>,
  input: PasteImportInput,
): Promise<SaveImportResult> {
  if (!spec.allowed) return { error: spec.notAllowed, counts: null };
  const request = readRequest(spec.kind, input);
  if (!request.success) {
    return {
      error: request.error.issues[0]?.message ?? "Check the paste.",
      counts: null,
    };
  }
  const supabase = await createClient();
  const context = await spec.load(supabase);
  if (!context) {
    return { error: "Could not save the rows. Try again.", counts: null };
  }

  const plan = spec.plan(request.data.text, request.data.onDuplicate, context);
  const rows = spec.payload(plan);
  if (rows.length === 0) {
    return {
      error: "No rows to save. Fix the rows marked in red.",
      counts: null,
    };
  }

  const { error } = await supabase.rpc(spec.rpc, { import_rows: rows });
  if (error) {
    const known = spec.explain?.(error);
    if (known) return { error: known, counts: null };
    if (error.code === NOT_PERMITTED) {
      return { error: spec.notAllowed, counts: null };
    }
    if (error.code === UNIQUE_VIOLATION) {
      return {
        error: "Someone added one of these just now. Check the rows again.",
        counts: null,
      };
    }
    console.error(`Could not run ${spec.rpc}`, error);
    return {
      error: "Could not save the rows. Nothing was saved.",
      counts: null,
    };
  }

  for (const path of spec.revalidate) revalidatePath(path);
  return { error: null, counts: countActions(plan.rows) };
}
