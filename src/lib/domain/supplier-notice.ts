import { type CalendarDate, formatDate } from "@/lib/format/date";
import { formatQuantity } from "@/lib/format/quantity";
import {
  type ReservationStatus,
  STOCK_UNIT_LABEL,
  type StockUnit,
} from "./reservation";

// Values mirror the check constraint in the supplier notice migration.
export const SUPPLIER_NOTICES = ["reserve", "extend", "release"] as const;
export type SupplierNotice = (typeof SUPPLIER_NOTICES)[number];

export const SUPPLIER_NOTICE_LABEL: Record<SupplierNotice, string> = {
  reserve: "Reserve",
  extend: "Extend",
  release: "Release",
};

export type NoticeLine = {
  id: string;
  status: ReservationStatus;
  sku: string;
  supplier: string;
  collection: string;
  qty: number;
  unit: StockUnit;
  projectName: string;
  expiresOn: CalendarDate | null;
  supplierNotice: SupplierNotice | null;
  supplierNotifiedAt: string | null;
};

/** A notice only matters while the line is still in the state it was raised for. */
const stillNeeded = (line: NoticeLine) =>
  line.supplierNotice === "release"
    ? line.status === "released"
    : (line.status === "reserved" || line.status === "po_issued") &&
      line.expiresOn !== null;

/** Lines whose supplier has not been told yet. */
export const pendingNotices = <Line extends NoticeLine>(
  lines: readonly Line[],
): Line[] =>
  lines.filter(
    (line) =>
      line.supplierNotice !== null &&
      line.supplierNotifiedAt === null &&
      stillNeeded(line),
  );

export type SupplierEmail = {
  supplier: string;
  /** The lines this email covers, with the notice each was raised as. */
  lines: { id: string; notice: SupplierNotice }[];
  subject: string;
  body: string;
  /** The supplier's address is not stored, so the To field is empty. */
  mailto: string;
};

const lineText = (line: NoticeLine) =>
  `- ${line.sku}${line.collection ? ` (${line.collection})` : ""}: ${formatQuantity(line.qty)} ${STOCK_UNIT_LABEL[line.unit]}${line.projectName ? ` · project ${line.projectName}` : ""}`;

/** The latest hold end among the lines. */
const lastExpiry = (lines: readonly NoticeLine[]) =>
  lines
    .map((line) => line.expiresOn)
    .filter((date): date is CalendarDate => date !== null)
    .sort()
    .at(-1);

/**
 * One draft per supplier, covering every line to reserve, extend or release. The person opens
 * it in their own email app; nothing is sent from here.
 */
export function supplierEmails(
  pending: readonly NoticeLine[],
  { sender, today }: { sender: string; today: CalendarDate },
): SupplierEmail[] {
  const bySupplier = new Map<string, NoticeLine[]>();
  for (const line of pending) {
    bySupplier.set(line.supplier, [
      ...(bySupplier.get(line.supplier) ?? []),
      line,
    ]);
  }

  return [...bySupplier]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([supplier, lines]) => {
      const of = (notice: SupplierNotice) =>
        lines.filter((line) => line.supplierNotice === notice);
      const reserve = of("reserve");
      const extend = of("extend");
      const release = of("release");

      const parts = [
        reserve.length > 0 &&
          `Please RESERVE the following stock for GQ Projects until ${formatDate(lastExpiry(reserve) ?? today)}:\n${reserve.map(lineText).join("\n")}`,
        extend.length > 0 &&
          `Please EXTEND the hold on the following stock until the date shown:\n${extend.map((line) => `${lineText(line)} · until ${formatDate(line.expiresOn ?? today)}`).join("\n")}`,
        release.length > 0 &&
          `Please RELEASE the following stock. We no longer need it on hold:\n${release.map(lineText).join("\n")}`,
      ].filter(Boolean);
      const kinds = [
        reserve.length > 0 && "reservation",
        extend.length > 0 && "extension",
        release.length > 0 && "release",
      ].filter(Boolean);

      const subject = `GQ Projects - stock ${kinds.join(" / ")} - ${formatDate(today)}`;
      const body = `Dear ${supplier} team,\n\n${parts.join("\n\n")}\n\nPlease confirm by reply. Thank you.\n\nBest regards,\n${sender}\nGQ Projects Sdn Bhd`;
      return {
        supplier,
        lines: lines.flatMap((line) =>
          line.supplierNotice
            ? [{ id: line.id, notice: line.supplierNotice }]
            : [],
        ),
        subject,
        body,
        mailto: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      };
    });
}
