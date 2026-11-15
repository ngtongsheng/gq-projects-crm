import { LineUnitLabel } from "../../mofs/schemas";
import type { FormMof } from "./form-mof-data";
import {
  FormFootnote,
  FormGrid,
  FormPairs,
  FormSection,
  FormSignatures,
  FormWritingBox,
} from "./form-parts";

const ROWS = 15;

/** Site measurement summary (demo printMeasure): quantities stay blank, they are measured on site. */
export function MeasurementForm({ mof }: { mof: FormMof | null }) {
  const supervisor = mof?.siteSupervisor ?? "";
  return (
    <>
      <FormSection title="Project Details" />
      <FormPairs
        rows={[
          ["Project name", mof?.projectName ?? "", "MOF no.", mof?.mofNo ?? ""],
          ["Site address", mof?.siteAddress ?? "", "Measurement date", ""],
          [
            "Measured by (GQ)",
            supervisor,
            "Client PIC",
            mof?.clientContact ?? "",
          ],
        ]}
      />
      <FormSection title="Measurement by Product" />
      <FormGrid
        heads={[
          "No.",
          "Product (Type / Code / Colour)",
          "Area / Location",
          "Quantity",
          "Unit",
          "Remarks",
        ]}
        widths={["34px", "", "22%", "11%", "8%", "20%"]}
        rowHeight="26px"
        rows={Array.from({ length: ROWS }, (_, index) => {
          const line = mof?.lines[index];
          return {
            key: `row-${index + 1}`,
            cells: [
              index + 1,
              line?.product ?? "",
              "",
              "",
              line ? LineUnitLabel[line.unit] : "",
              "",
            ],
          };
        })}
      />
      <FormWritingBox
        label="Site remarks"
        hint="(access, floor condition, special cutting, pattern direction, etc.)"
        minHeight="64px"
      />
      <FormSignatures
        heads={[
          "Measured by (GQ Site Supervisor)",
          "Checked by (Sales / Project In-charge)",
        ]}
        signatureCaptions={["Signature:", "Signature:"]}
        rows={[
          {
            key: "name",
            left: `Name: ${supervisor}`,
            right: `Name: ${mof?.salesperson ?? ""}`,
          },
          { key: "date", left: "Date:", right: "Date:" },
        ]}
      />
      <FormFootnote>
        Quantities are actual site measurement (before wastage). Attach site
        sketch / photos and file under the MOF No.
      </FormFootnote>
    </>
  );
}
