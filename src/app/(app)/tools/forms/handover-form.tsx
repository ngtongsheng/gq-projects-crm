import { formatQuantity } from "@/lib/format/quantity";
import { LineUnitLabel } from "../../mofs/schemas";
import type { FormMof } from "./form-mof-data";
import {
  FormChecklist,
  FormGrid,
  FormPairs,
  FormSignatures,
  FormWritingBox,
} from "./form-parts";

const CHECKLIST = [
  "Installation completed according to scope",
  "Area cleaned, debris and offcuts removed",
  "Balance stock collected / handed over",
  "No visible defects (or listed below)",
  "Completed photos taken (min. 4) and posted in job-site WhatsApp group",
  "Care & maintenance advice given to client",
];

const MIN_ROWS = 5;

/** Project handover form HO-01 (demo printHandover). */
export function HandoverForm({ mof }: { mof: FormMof | null }) {
  const lines = mof?.lines ?? [];
  const rowCount = Math.max(MIN_ROWS, lines.length);
  return (
    <>
      <FormPairs
        rows={[
          ["MOF no.", mof?.mofNo ?? "", "Handover date", ""],
          [
            "Project",
            mof?.projectName ?? "",
            "GQ salesperson",
            mof?.salesperson ?? "",
          ],
          [
            "Site address",
            mof?.siteAddress ?? "",
            "Client contact",
            mof?.clientContact ?? "",
          ],
          ["Client / company", mof?.companyName ?? "", "", ""],
        ]}
      />
      <div className="mt-3">
        <FormGrid
          heads={["No.", "Product / scope of work", "Area / qty", "Remarks"]}
          widths={["40px", "", "120px", "160px"]}
          rows={Array.from({ length: rowCount }, (_, index) => {
            const line = lines[index];
            return {
              key: `row-${index + 1}`,
              cells: line
                ? [
                    index + 1,
                    line.product,
                    `${formatQuantity(line.qty)} ${LineUnitLabel[line.unit]}`,
                    "",
                  ]
                : ["", "", "", ""],
            };
          })}
        />
      </div>
      <div className="mt-3">
        <FormChecklist items={CHECKLIST} />
      </div>
      <FormWritingBox
        label="Defects / outstanding items / remarks:"
        minHeight="70px"
      />
      <p className="my-2.5 text-[11.5px]">
        The client confirms the above works have been completed and handed over
        in good condition, except for the items noted above.
      </p>
      <FormSignatures
        heads={["Handed over by (GQ Projects)", "Accepted by (Client)"]}
        signatureCaptions={["Signature", "Signature & company stamp"]}
        signatureHeight="70px"
        rows={[
          {
            key: "name",
            left: `Name: ${mof?.siteSupervisor ?? ""}`,
            right: "Name:",
          },
          { key: "date", left: "Date:", right: "Date:" },
        ]}
      />
    </>
  );
}
