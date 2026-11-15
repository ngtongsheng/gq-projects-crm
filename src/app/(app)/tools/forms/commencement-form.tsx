import { flooringTypes, installationAreaSqft } from "@/lib/domain/print-forms";
import { formatQuantity } from "@/lib/format/quantity";
import type { FormMof } from "./form-mof-data";
import {
  FORM_BORDER,
  FormFootnote,
  FormNote,
  FormPairs,
  FormSection,
  FormSignatures,
  FormTickPairs,
} from "./form-parts";

const tick = (on: boolean, label: string) => `${on ? "☑" : "☐"} ${label}`;

/** Work commencement / site condition acknowledgement (demo printCommence). */
export function CommencementForm({ mof }: { mof: FormMof | null }) {
  const supervisor = mof?.siteSupervisor ?? "";
  const types = flooringTypes(mof?.lines.map((line) => line.product) ?? []);
  const area = mof ? installationAreaSqft(mof.lines) : null;
  return (
    <>
      <FormSection title="Project Details" />
      <FormPairs
        rows={[
          ["Project name", mof?.projectName ?? "", "MOF no.", mof?.mofNo ?? ""],
          [
            "Site address / area",
            mof?.siteAddress ?? "",
            "Date of inspection",
            "",
          ],
        ]}
      />
      <FormPairs
        rows={[
          [
            "Flooring type",
            `${tick(types.carpet, "Carpet")}  ${tick(types.vinyl, "Vinyl")}  ☐ Others`,
            "Installation area (sqft)",
            area === null ? "" : formatQuantity(area),
          ],
          ["Site supervisor (GQ)", supervisor, "Supervisor contact no.", ""],
        ]}
      />
      <FormSection title="1. Site Condition" />
      <FormNote bottom={false}>
        The subfloor must be structurally sound, level, clean, dry and free from
        cracks, moisture, oil, paint, dust and potholes before carpet/vinyl can
        be installed. Upon site inspection, GQ found the subfloor is NOT READY
        to receive the flooring, and has advised the client/representative to
        carry out the following rectification works before installation (tick
        where applicable):
      </FormNote>
      <FormTickPairs
        rows={[
          ["Self-levelling", "Moisture barrier"],
          ["Grinding / patching", "Surface cleaning"],
          ["Crack repair", "Others: ______________________"],
        ]}
      />
      <FormNote top={false} bottom={false}>
        If installation proceeds without completing the above works, the
        following issues may occur:
      </FormNote>
      <FormTickPairs
        rows={[
          ["Uneven or wavy surface", "Visible bumps or ridges"],
          ["Peeling or debonding", "Adhesive failure"],
          [
            "Lifting at joints or corners",
            "Reduced durability / shortened lifespan",
          ],
        ]}
      />
      <FormSection title="2. Moisture Level" />
      <FormPairs
        rows={[["Moisture reading (%)", "", "Test method / meter", ""]]}
      />
      <FormNote top={false}>
        The maximum acceptable subfloor moisture content is below 10%. Above
        this limit, a moisture barrier is strongly advised before installation.
        Test results only reflect the condition at the time of testing and
        cannot predict future changes. GQ shall not be held responsible for any
        problems caused by rising or fluctuating moisture after installation.
        <br />
        Installing over high-moisture subfloors may cause: adhesive
        deterioration or loss of bond, tile peaking / curling / edge lifting,
        bumps or bubbles, and mould, mildew or bacterial growth.
      </FormNote>
      <FormSection title="3. Client Decision (tick one)" />
      <table className={`w-full border-collapse ${FORM_BORDER}`}>
        <tbody>
          <tr>
            <td className="px-1.5 py-1">
              ☐ Rectify the subfloor first, then install
            </td>
          </tr>
          <tr>
            <td className="border-t border-[#242e38] px-1.5 py-1">
              ☐ Proceed with installation now, at the client's own risk
            </td>
          </tr>
        </tbody>
      </table>
      <FormSection title="4. Client Acknowledgement" />
      <FormNote>
        By signing below, the client/site representative confirms that:
        <br />
        a) they have been informed of the current site condition and the risks
        above;
        <br />
        b) they instruct GQ to proceed with installation at their own risk;
        <br />
        c) GQ's workmanship and product warranty does NOT cover any defect
        caused by the subfloor condition or moisture;
        <br />
        d) any future rectification, removal or reinstallation work will be
        charged separately, subject to a new quotation;
        <br />
        e) photos of the site condition taken by GQ on the inspection date form
        part of this record.
      </FormNote>
      <FormSignatures
        heads={["Client / Site Representative", "GQ Site Supervisor"]}
        signatureCaptions={["Signature", "Signature"]}
        signatureHeight="38px"
        rows={[
          { key: "name", left: "Name", right: `Name: ${supervisor}` },
          { key: "ic", left: "IC No.", right: "Date" },
          {
            key: "company",
            left: `Company: ${mof?.companyName ?? ""}`,
            right: "Client company stamp",
          },
        ]}
      />
      <FormFootnote>
        One copy for the client, one copy for GQ project file (filed under the
        MOF No.).
      </FormFootnote>
    </>
  );
}
