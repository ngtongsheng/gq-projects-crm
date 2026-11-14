"use client";

import { Printer } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type PrintLayoutProps = {
  /** Form name, shown large on the right of the title block, e.g. "Delivery order". */
  title: string;
  /** Small label-value pairs under the title, e.g. DO no., date. */
  meta?: { label: string; value: string }[];
  /** Toolbar heading above the page (screen only). */
  toolbarTitle?: string;
  children: ReactNode;
};

/** Company details printed in every form's title block (from the demo's DO header). */
const COMPANY = {
  name: "GQ Projects Sdn Bhd",
  address: [
    "D-1-13 15, Capital 4, Oasis Square, 2, Jalan PJU 1A/7A,",
    "Oasis Damansara, 47301 Petaling Jaya, Selangor",
    "t 03 7480 0748 · m 012 2022 905",
    "sales@gqprojects.com.my · www.gqprojects.com.my",
  ],
};

/**
 * One A4 sheet shared by every printable form (D4). On screen it is a white page on a grey
 * desk with a Print button; the global print rules hide the app shell around it. "Download PDF"
 * is the browser's Save as PDF in the print dialog.
 */
export function PrintLayout({
  title,
  meta,
  toolbarTitle,
  children,
}: PrintLayoutProps) {
  return (
    <div className="print-desk -mx-4 -my-5 bg-muted px-4 py-5 print:m-0 print:bg-white print:p-0">
      <div className="mx-auto mb-3 flex w-[210mm] max-w-full items-center gap-3 print:hidden">
        <strong className="min-w-0 flex-1 truncate">
          {toolbarTitle ?? title}
        </strong>
        <Button type="button" onClick={() => window.print()}>
          <Printer aria-hidden />
          Print / Save as PDF
        </Button>
      </div>
      <article className="print-sheet mx-auto box-border min-h-[297mm] w-[210mm] max-w-full bg-white p-[12mm] font-[Arial,Helvetica,sans-serif] text-xs leading-[1.4] text-[#242e38] shadow-md print:m-0 print:min-h-0 print:w-auto print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start gap-3.5">
          <Image
            src="/gqp-office-logo.png"
            alt="GQ Projects"
            width={168}
            height={84}
            className="h-auto w-[110px]"
            priority
          />
          <div className="flex-1">
            <div className="text-sm font-bold">{COMPANY.name}</div>
            <div className="text-[10px] text-[#7a8691]">
              {COMPANY.address.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
          <div className="min-w-[200px]">
            <div className="text-right text-[22px] font-bold uppercase">
              {title}
            </div>
            {meta && meta.length > 0 && (
              <table className="mt-1 w-full border-collapse text-[11px]">
                <tbody>
                  {meta.map((row) => (
                    <tr key={row.label}>
                      <td className="border border-[#242e38] bg-[#eef1f4] px-1.5 py-0.5 text-[10px] font-bold uppercase">
                        {row.label}
                      </td>
                      <td className="border border-[#242e38] px-1.5 py-0.5 font-bold">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </header>
        <div className="mt-4">{children}</div>
      </article>
    </div>
  );
}

type Signer = {
  /** Who signs, e.g. "Received by (customer)". */
  label: string;
  /** Caption under the line, e.g. "Signature & company stamp". */
  caption?: string;
  /** Extra blank lines to fill in, e.g. ["Name", "Date & time"]. */
  fields?: string[];
};

/** A row of signature boxes with fill-in lines, as on the demo's delivery order and handover form. */
export function PrintSignatureRow({ signers }: { signers: Signer[] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-4 break-inside-avoid">
      {signers.map((signer) => (
        <div key={signer.label}>
          <div className="text-[9px] font-bold text-[#7a8691] uppercase">
            {signer.label}
          </div>
          <div className="mt-1 h-[70px] border-b border-[#242e38]" />
          {signer.caption && (
            <div className="text-[10px] text-[#7a8691]">{signer.caption}</div>
          )}
          {signer.fields && signer.fields.length > 0 && (
            <table className="mt-1.5 w-full border-collapse text-[11px]">
              <tbody>
                {signer.fields.map((field) => (
                  <tr key={field}>
                    <td className="w-[38%] border border-[#242e38] bg-[#eef1f4] px-1.5 py-1 text-[10px] font-bold uppercase">
                      {field}
                    </td>
                    <td className="border border-[#242e38] px-1.5 py-1" />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
