"use server";

import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { canEditSamples } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { SAMPLE_UNITS } from "@/lib/domain/samples";
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
  planSampleImport,
  type SampleImportContext,
  type SampleImportRow,
  sampleImportFields,
  sampleImportPayload,
  sampleKey,
} from "./sample-import";

const sampleRows = z.array(
  z.object({
    id: z.string(),
    brand: z.string().nullable(),
    sku: z.string().nullable(),
    name: z.string().nullable(),
    unit: z.enum(SAMPLE_UNITS),
  }),
);

function specFor(
  me: Profile,
): PasteImportSpec<
  SampleImportContext,
  (typeof sampleImportFields)[number]["key"],
  SampleImportRow
> {
  return {
    kind: "samples",
    allowed: canEditSamples(me),
    notAllowed: "Only the people who look after samples can paste samples.",
    async load(supabase) {
      const { data, error } = await supabase
        .from("samples")
        .select("id, brand, sku, name, unit");
      if (error) {
        console.error("Could not load samples for import", error);
        return null;
      }
      return {
        samples: new Map(
          sampleRows
            .parse(data)
            .map((row) => [sampleKey(row), { id: row.id, unit: row.unit }]),
        ),
      };
    },
    plan: planSampleImport,
    toPreview: (plan) => toImportPreview(plan, sampleImportFields),
    payload: sampleImportPayload,
    rpc: "import_samples",
    revalidate: ["/samples"],
  };
}

/** Parses and checks a paste against the sample list without saving anything. */
export async function previewSampleImport(
  input: PasteImportInput,
): Promise<PreviewImportResult> {
  const me = await requirePage("stock");
  return previewPasteImport(specFor(me), input);
}

/** Saves the valid samples of a paste. A sample already listed gets the pasted columns, quantity included. */
export async function importSamples(
  input: PasteImportInput,
): Promise<SaveImportResult> {
  const me = await requirePage("stock");
  return savePasteImport(specFor(me), input);
}
