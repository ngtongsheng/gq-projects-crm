"use server";

import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { requirePage } from "@/lib/auth/require-page";
import { canRecordLeftover } from "@/lib/domain/leftover";
import { toImportPreview } from "@/lib/import/import-plan";
import {
  type PasteImportInput,
  type PasteImportSpec,
  type PreviewImportResult,
  previewPasteImport,
  type SaveImportResult,
  savePasteImport,
} from "@/lib/import/paste-import-action";
import {
  type LeftoverImportContext,
  type LeftoverImportRow,
  leftoverImportFields,
  leftoverImportPayload,
  leftoverKey,
  planLeftoverImport,
} from "./leftover-import";

const mofRows = z.array(z.object({ id: z.string(), mof_no: z.string() }));
const leftoverRows = z.array(
  z.object({
    id: z.string(),
    mof_id: z.string(),
    item: z.string(),
    qty: z.number(),
    unit: z.string(),
    condition: z.string(),
    destination: z.string(),
  }),
);

function specFor(
  me: Profile,
): PasteImportSpec<
  LeftoverImportContext,
  (typeof leftoverImportFields)[number]["key"],
  LeftoverImportRow
> {
  return {
    kind: "leftover",
    allowed: canRecordLeftover(me),
    notAllowed:
      "Only a site supervisor or the people who arrange stock can record leftover stock.",
    async load(supabase) {
      const [mofs, leftovers] = await Promise.all([
        supabase.from("mofs").select("id, mof_no"),
        supabase
          .from("leftovers")
          .select("id, mof_id, item, qty, unit, condition, destination"),
      ]);
      if (mofs.error || leftovers.error) {
        console.error(
          "Could not load leftover stock for import",
          mofs.error ?? leftovers.error,
        );
        return null;
      }
      return {
        mofs: new Map(
          mofRows
            .parse(mofs.data)
            .map((row) => [row.mof_no.toUpperCase(), row.id]),
        ),
        recorded: new Map(
          leftoverRows.parse(leftovers.data).map((row) => [
            leftoverKey({
              mofId: row.mof_id,
              item: row.item,
              qty: row.qty,
              unit: row.unit,
              condition: row.condition,
              destination: row.destination,
            }),
            row.id,
          ]),
        ),
      };
    },
    // Leftover is only ever added, so "update" has no meaning here.
    plan: (text, _onDuplicate, context) => planLeftoverImport(text, context),
    toPreview: (plan) => toImportPreview(plan, leftoverImportFields),
    payload: leftoverImportPayload,
    rpc: "import_leftovers",
    revalidate: ["/stock/leftover"],
  };
}

/** Parses and checks a paste against the recorded leftover without saving anything. */
export async function previewLeftoverImport(
  input: PasteImportInput,
): Promise<PreviewImportResult> {
  const me = await requirePage("stock");
  return previewPasteImport(specFor(me), input);
}

/** Saves the new leftover items of a paste, each waiting for pickup. */
export async function importLeftovers(
  input: PasteImportInput,
): Promise<SaveImportResult> {
  const me = await requirePage("stock");
  return savePasteImport(specFor(me), input);
}
