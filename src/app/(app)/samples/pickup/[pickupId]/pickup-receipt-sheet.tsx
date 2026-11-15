import type { ReactNode } from "react";
import { PICKUP_MAX_LINES, PICKUP_METHOD_LABEL } from "@/lib/domain/samples";
import { formatQuantity } from "@/lib/format/quantity";
import { FORM_BORDER } from "../../../tools/forms/form-parts";
import type { PickupFormRow } from "../../samples-data";

const COMPANY_NAME = "GQ PROJECTS SDN BHD";

const LABEL = `${FORM_BORDER} bg-[#eef1f4] px-2 py-1.5 text-left font-bold`;
const CELL = `${FORM_BORDER} px-2 py-1.5 align-top`;

/** A printed label: Chinese on top, English under it, as on the paper form. */
function Label({ zh, en }: { zh: string; en: string }) {
  return (
    <th scope="row" className={`${LABEL} w-[22%]`}>
      {zh}
      <br />
      <span className="text-[10px] font-normal text-[#7a8691]">{en}</span>
    </th>
  );
}

function Head({ zh, en, width }: { zh: string; en: string; width?: string }) {
  return (
    <th className={`${LABEL} text-center`} style={{ width }}>
      {zh}
      <br />
      <span className="text-[10px] font-normal text-[#7a8691]">{en}</span>
    </th>
  );
}

function Pair({
  left,
  right,
}: {
  left: { zh: string; en: string; value: ReactNode };
  right: { zh: string; en: string; value: ReactNode };
}) {
  return (
    <tr>
      <Label zh={left.zh} en={left.en} />
      <td className={`${CELL} w-[28%]`}>{left.value}</td>
      <Label zh={right.zh} en={right.en} />
      <td className={CELL}>{right.value}</td>
    </tr>
  );
}

/**
 * The A4 body of "V-GQ SIGNATURE RECEIPT" (demo printSmpPick): what Best Link hands over, and
 * where the person collecting signs. Up to 10 item rows, blank rows filling the table.
 */
export function PickupReceiptSheet({
  form,
  formDate,
  appointmentOn,
}: {
  form: PickupFormRow;
  /** Already formatted for printing. */
  formDate: string;
  appointmentOn: string;
}) {
  const blankRows = Math.max(0, PICKUP_MAX_LINES - form.lines.length);

  return (
    <>
      <table className="w-full border-collapse">
        <tbody>
          <Pair
            left={{ zh: "提货单位", en: "Company Name:", value: COMPANY_NAME }}
            right={{ zh: "日期", en: "Date:", value: formDate }}
          />
          <Pair
            left={{
              zh: "联系人",
              en: "Person In Charge:",
              value: form.personInCharge,
            }}
            right={{ zh: "联系号码", en: "Contact:", value: form.contact }}
          />
        </tbody>
      </table>

      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr>
            <th colSpan={4} className={`${LABEL} bg-[#dfe4e9] text-center`}>
              提货资料 DELIVERY DETAILS
            </th>
          </tr>
        </thead>
        <tbody>
          <Pair
            left={{
              zh: "提货方式",
              en: "Delivery Method:",
              value: PICKUP_METHOD_LABEL[form.method],
            }}
            right={{
              zh: "提货日期",
              en: "Appointment Date:",
              value: appointmentOn,
            }}
          />
          <Pair
            left={{
              zh: "司机联系方式",
              en: "Driver Contact:",
              value: form.driverContact ?? "",
            }}
            right={{
              zh: "车牌号",
              en: "Vehicle No.:",
              value: form.vehicleNo ?? "",
            }}
          />
          <tr>
            <Label zh="客户地址" en="Address (Optional)" />
            <td colSpan={3} className={CELL}>
              {form.address ?? ""}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="mt-3.5 w-full border-collapse">
        <thead>
          <tr>
            <Head zh="序号" en="No." width="44px" />
            <Head zh="货品名称" en="Product Name" />
            <Head zh="规格" en="Specification (Optional)" />
            <Head zh="数量" en="Quantity" width="80px" />
            <Head zh="备注" en="Remarks" width="120px" />
          </tr>
        </thead>
        <tbody>
          {form.lines.map((line, index) => (
            <tr key={line.position} style={{ height: "26px" }}>
              <td className={`${CELL} text-center`}>{index + 1}</td>
              <td className={`${CELL} font-bold`}>{line.productName}</td>
              <td className={CELL}>{line.spec ?? ""}</td>
              <td className={CELL}>
                {formatQuantity(line.qty)} {line.unit}
              </td>
              <td className={CELL}>{line.remarks ?? ""}</td>
            </tr>
          ))}
          {Array.from({ length: blankRows }, (_, index) => (
            <tr key={`blank-${index + 1}`} style={{ height: "26px" }}>
              <td className={CELL} />
              <td className={CELL} />
              <td className={CELL} />
              <td className={CELL} />
              <td className={CELL} />
            </tr>
          ))}
        </tbody>
      </table>

      <table className="mt-7 border-collapse break-inside-avoid text-sm">
        <tbody>
          {[
            ["签名", "Signature :"],
            ["身份证号", "IC:"],
            ["签收日期", "Received Date:"],
          ].map(([zh, en]) => (
            <tr key={en}>
              <td className="py-2.5 pr-3 whitespace-nowrap">
                {zh} {en}
              </td>
              <td className="w-[260px] border-b border-[#242e38]" />
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
