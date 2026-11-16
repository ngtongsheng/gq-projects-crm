import { PrintSignatureRow } from "@/components/app/print-layout";
import {
  blankPrintRows,
  type DoLine,
  totalQty,
} from "@/lib/domain/delivery-order";
import { formatQuantity } from "@/lib/format/quantity";
import {
  FORM_BORDER,
  FormGrid,
  FormNote,
  FormPairs,
  FormWritingBox,
} from "../../../tools/forms/form-parts";
import type { PrintableDo } from "./print-data";

const OFFICE_MOBILE = "012 2022 905";

function Party({
  label,
  name,
  address,
}: {
  label: string;
  name: string;
  address: string;
}) {
  return (
    <div className={`${FORM_BORDER} min-h-[52px] px-2 py-1`}>
      <div className="text-[10px] font-bold uppercase text-[#7a8691]">
        {label}
      </div>
      <div className="font-bold">{name}</div>
      <div className="whitespace-pre-line">{address}</div>
    </div>
  );
}

const cell = (value: string | null) => value ?? "";

/** The A4 body of a delivery order (demo printDO); the title block comes from PrintLayout. */
export function DeliveryOrderSheet({
  order,
  doDate,
}: {
  order: PrintableDo;
  /** Already formatted for printing. */
  doDate: string;
}) {
  const quote = order.quoteNo ? ` / ${order.quoteNo}` : "";
  const rows = [
    ...order.lines.map((line: DoLine, index) => ({
      key: `line-${index + 1}`,
      cells: [
        index + 1,
        line.product,
        cell(line.code),
        <>
          {cell(line.description)}
          {line.covers && (
            <div className="text-[10px] text-[#7a8691]">Qty: {line.covers}</div>
          )}
        </>,
        cell(line.batch),
        line.unit,
        <div key="qty" className="text-right">
          {formatQuantity(line.qty)}
        </div>,
      ],
    })),
    ...Array.from(
      { length: blankPrintRows(order.lines.length) },
      (_, index) => ({
        key: `blank-${index + 1}`,
        cells: ["", "", "", "", "", "", ""],
      }),
    ),
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Party
          label="Bill to"
          name={order.billTo.name}
          address={order.billTo.address}
        />
        <Party
          label="Deliver to"
          name={order.deliverTo.name}
          address={order.deliverTo.address}
        />
      </div>
      <div className="mt-3">
        <FormPairs
          rows={[
            ["Delivery date", doDate, "Client PO no.", order.clientPoNo],
            [
              "GQ job / quote no.",
              `${order.mofNo}${quote}`,
              "Salesperson",
              order.salesperson,
            ],
            [
              "Site PIC",
              order.sitePic,
              "Site PIC contact",
              order.sitePicContact,
            ],
            [
              "Office PIC",
              order.officePic,
              "Office PIC contact",
              OFFICE_MOBILE,
            ],
          ]}
        />
      </div>
      <div className="mt-3">
        <FormGrid
          heads={[
            "#",
            "Product",
            "Item code",
            "Description",
            "Batch / lot no.",
            "Unit",
            "Qty",
          ]}
          widths={["28px", "", "", "", "", "44px", "64px"]}
          rows={rows}
          rowHeight="22px"
        />
        <FormNote top={false}>
          <div className="flex justify-between font-bold">
            <span>
              {order.lines.length} item line(s) ·{" "}
              {order.isFinal ? "FINAL DELIVERY" : "PARTIAL DELIVERY"}
            </span>
            <span>TOTAL {formatQuantity(totalQty(order.lines))}</span>
          </div>
        </FormNote>
      </div>
      <FormWritingBox
        label="Delivery notes · shortage or damage (if any)"
        hint={order.remarks ? `: ${order.remarks}` : undefined}
        minHeight="50px"
      />
      <div className="mt-3 font-bold">Acknowledgement</div>
      <div className="text-[10px] text-[#7a8691]">
        Goods received in good order and condition, except as noted above.
      </div>
      <PrintSignatureRow
        signers={[
          {
            label: "Received by (customer)",
            caption: "Signature & company stamp",
            fields: ["Name", "Designation", "Date & time"],
          },
          {
            label: "Delivered by (GQ Projects)",
            caption: order.transporter
              ? `Signature · Transporter: ${order.transporter}`
              : "Signature",
            fields: ["Driver name", "Vehicle no.", "Date & time"],
          },
        ]}
      />
      <div className="mt-3.5 text-center text-[10px] text-[#7a8691]">
        Thank you for your business. · GQ Projects Sdn Bhd · 03 7480 0748 ·
        www.gqprojects.com.my
      </div>
    </>
  );
}
