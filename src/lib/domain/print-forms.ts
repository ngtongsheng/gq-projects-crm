import { m2ToSqft } from "./area";
import { type LineUnit, totalAreaM2 } from "./mof-totals";

/** The three A4 forms printed from Tools & Forms (demo FORM_LIST), in the demo's order. */
export const PRINT_FORMS = ["measure", "commence", "handover"] as const;
export type PrintForm = (typeof PRINT_FORMS)[number];

export const PRINT_FORM_INFO: Record<
  PrintForm,
  { title: string; summary: string }
> = {
  measure: {
    title: "Site measurement summary",
    summary:
      "Site supervisor records actual measurement by product; sales / project in-charge checks.",
  },
  commence: {
    title: "Work commencement / site condition acknowledgement",
    summary:
      "When the subfloor is not ready or moisture is high – client chooses to rectify first or proceed at own risk, and signs.",
  },
  handover: {
    title: "Project handover form",
    summary: "Site supervisor brings it to the handover; client signs.",
  },
};

export function parsePrintForm(value: string): PrintForm | null {
  return PRINT_FORMS.find((form) => form === value) ?? null;
}

/** Ticks "Carpet" and "Vinyl" on the commencement form from the product names (demo printCommence). */
export function flooringTypes(products: readonly string[]): {
  carpet: boolean;
  vinyl: boolean;
} {
  const text = products.join(" ");
  return { carpet: /carpet/i.test(text), vinyl: /vinyl|lvt|spc/i.test(text) };
}

/** The MOF's whole area in square feet, or null when no line has an area. */
export function installationAreaSqft(
  lines: readonly { qty: number; unit: LineUnit; areaM2: number }[],
): number | null {
  const m2 = totalAreaM2(lines);
  return m2 > 0 ? Math.round(m2ToSqft(m2)) : null;
}
