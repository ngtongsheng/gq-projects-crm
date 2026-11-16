import { formatQuantity } from "@/lib/format/quantity";
import { formatPickupNo, type PickupMethod, type SampleUnit } from "./samples";

// The message goes to Best Link's warehouse, so it is in Chinese (demo ZM and ZU).
const METHOD_ZH: Record<PickupMethod, string> = {
  lalamove: "Lalamove",
  self_pickup: "自取 Self pick-up",
  transporter: "货车 Transporter",
};

const UNIT_ZH: Record<SampleUnit, string> = {
  pc: "片",
  box: "箱",
  set: "套",
  roll: "卷",
  sheet: "张",
  "m²": "平方米",
  catalogue: "本",
};

export type PickupMessage = {
  runningNo: number;
  /** Already formatted for reading, e.g. "20 Nov 2026". */
  appointmentOn: string;
  method: PickupMethod;
  personInCharge: string;
  contact: string;
  driverContact: string | null;
  vehicleNo: string | null;
  lines: {
    productName: string;
    spec: string | null;
    qty: number;
    unit: SampleUnit;
    remarks: string | null;
  }[];
};

/** The Chinese WhatsApp text that goes with the signature receipt PDF (demo printSmpPick). */
export function pickupWhatsAppText(form: PickupMessage): string {
  const no = formatPickupNo(form.runningNo);
  const items = form.lines.map((line, index) => {
    const spec = line.spec ? ` ${line.spec}` : "";
    const remarks = line.remarks ? `（${line.remarks}）` : "";
    return `${index + 1}. ${line.productName}${spec} × ${formatQuantity(line.qty)}${UNIT_ZH[line.unit]}${remarks}`;
  });
  return [
    `您好 Best Link，GQ Projects 提货 ${no}`,
    `提货日期：${form.appointmentOn}`,
    `提货方式：${METHOD_ZH[form.method]}`,
    `联系人：${form.personInCharge} ${form.contact}`,
    form.driverContact ? `司机：${form.driverContact}` : null,
    form.vehicleNo ? `车牌号：${form.vehicleNo}` : null,
    "",
    "货品：",
    ...items,
    "",
    "附上签收单 PDF，请安排。谢谢！",
    `(Sample pickup ${no} – signature receipt PDF attached. Thank you.)`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * wa.me link to Best Link with the text filled in. The number is digits with the country code
 * (the setting is checked that way); with none set, WhatsApp opens and the sender picks the chat.
 */
export function whatsAppLink(number: string | null, text: string): string {
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
}
