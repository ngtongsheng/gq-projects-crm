import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PrintLayout } from "@/components/app/print-layout";
import { canOpen } from "@/lib/auth/page-access";
import { requirePage } from "@/lib/auth/require-page";
import { doPrintNotices } from "@/lib/domain/delivery-order";
import { deliveryOrderNumber } from "@/lib/domain/delivery-status";
import { formatDate } from "@/lib/format/date";
import { DeliveryOrderSheet } from "./delivery-order-sheet";
import { loadPrintableDo } from "./print-data";

export const metadata: Metadata = { title: "Delivery order" };

const link =
  "rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted/50";

/**
 * A delivery order on A4. Warns on screen when the MOF's payment check or the DO pre-approval
 * is not ticked, or the DO has no number or items; it never blocks printing (D3).
 */
export default async function DeliveryOrderPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const me = await requirePage("inst");
  const { jobId } = await params;
  if (!z.uuid().safeParse(jobId).success) notFound();
  const order = await loadPrintableDo(jobId);
  if (!order) notFound();

  const number = deliveryOrderNumber(order.mofNo, order.runningNo);
  const notices = doPrintNotices({
    hasNumber: number !== null,
    lineCount: order.lines.length,
    paymentChecked: order.paymentChecked,
    dosPreApproved: order.dosPreApproved,
  });
  const backHref = (await canOpen(me, "mof"))
    ? `/mofs/${order.mofId}`
    : "/installation";
  const date = formatDate(order.doDate);

  return (
    <PrintLayout
      title="Delivery order"
      toolbarTitle={`DO ${number ?? "not issued"}`}
      meta={[
        { label: "DO no.", value: number ?? "Not issued" },
        { label: "Date", value: date },
        { label: "Page", value: "1 of 1" },
      ]}
      toolbarActions={
        <Link href={backHref} className={link}>
          Back
        </Link>
      }
      notice={
        notices.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border bg-warn-bg px-3 py-2 text-sm text-warn"
          >
            <strong>Check before printing</strong>
            <ul className="list-disc pl-5">
              {notices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </div>
        )
      }
    >
      <DeliveryOrderSheet order={order} doDate={date} />
    </PrintLayout>
  );
}
