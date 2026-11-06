"use server";

import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { canEditRegister, canSeeMofCost } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  type PasteImportInput,
  type PasteImportSpec,
  type PreviewImportResult,
  previewPasteImport,
  type SaveImportResult,
  savePasteImport,
} from "@/lib/import/paste-import-action";
import {
  type MofImportContext,
  type MofImportRow,
  type MofKey,
  mofImportFields,
  mofImportPayload,
  planMofImport,
  toMofImportPreview,
} from "./mof-import";

const mofRows = z.array(
  z.object({ id: z.string(), mof_no: z.string(), vo_amount: z.number() }),
);

function specFor(
  me: Profile,
): PasteImportSpec<MofImportContext, MofKey, MofImportRow> {
  // Cost is for managers only; for anyone else a Cost column is not imported.
  const fields = mofImportFields(canSeeMofCost(me.jobRole));
  return {
    kind: "mofs",
    allowed: canEditRegister(me.jobRole),
    notAllowed: "Only the MD, Purchasing or HR & Accounts can import MOFs.",
    async load(supabase) {
      const [team, mofs] = await Promise.all([
        getTeamDirectory(),
        supabase.from("mofs").select("id, mof_no, vo_amount"),
      ]);
      if (mofs.error) {
        console.error("Could not load MOFs for import", mofs.error);
        return null;
      }
      return {
        team,
        mofs: new Map(
          mofRows
            .parse(mofs.data)
            .map((row) => [
              row.mof_no.toUpperCase(),
              { id: row.id, voAmount: row.vo_amount },
            ]),
        ),
      };
    },
    plan: (text, onDuplicate, context) =>
      planMofImport(text, onDuplicate, context, fields),
    toPreview: (plan) => toMofImportPreview(plan, fields),
    payload: mofImportPayload,
    rpc: "import_mofs",
    revalidate: ["/mofs"],
  };
}

/** Parses and checks a paste against the register without saving anything. */
export async function previewMofImport(
  input: PasteImportInput,
): Promise<PreviewImportResult> {
  const me = await requireSection("mof");
  return previewPasteImport(specFor(me), input);
}

/**
 * Saves the valid MOFs of a paste. A changed contract sum or VO on an MOF already in the
 * register goes through update_mof_total with the reason "Imported".
 */
export async function importMofs(
  input: PasteImportInput,
): Promise<SaveImportResult> {
  const me = await requireSection("mof");
  return savePasteImport(specFor(me), input);
}
