import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import type { SiteMonthlyReport } from "@/lib/domain/site-monthly-report";

/** What the page adds around the figures. */
export type SiteReportPdfExtras = {
  /** "October 2026" */
  monthLabel: string;
  /** "Submitted 3 Nov 2026, 09:12", or "Not submitted yet". */
  submittedNote: string;
  supportNeeded: string | null;
  nextMonthPlan: string | null;
};

// A4 landscape, in points.
const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = MARGIN + 20;
const LINE = 11;
const PAD = 3;

const INK = rgb(0.1, 0.12, 0.15);
const MUTED = rgb(0.4, 0.43, 0.47);
const HEAD_FILL = rgb(0.13, 0.17, 0.21);
const ROW_LINE = rgb(0.82, 0.85, 0.87);

/** The standard PDF fonts only draw Western characters; anything else becomes "?". */
export function pdfSafe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^ -~ -ÿ–—•]/g, "?");
}

type Column = { header: string; width: number; align?: "right" };

class Writer {
  page: PDFPage;
  y = 0;

  private constructor(
    readonly doc: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  static async create() {
    const doc = await PDFDocument.create();
    return new Writer(
      doc,
      await doc.embedFont(StandardFonts.Helvetica),
      await doc.embedFont(StandardFonts.HelveticaBold),
    );
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensure(height: number) {
    if (this.y - height < BOTTOM) this.newPage();
  }

  /** Words wrapped to a width; a word wider than the width is cut. */
  wrap(text: string, width: number, font: PDFFont, size: number): string[] {
    const clean = pdfSafe(text).trim();
    if (clean === "") return [""];
    const lines: string[] = [];
    let current = "";
    for (const word of clean.split(/\s+/)) {
      let piece = word;
      while (font.widthOfTextAtSize(piece, size) > width && piece.length > 1) {
        let cut = piece.length - 1;
        while (
          cut > 1 &&
          font.widthOfTextAtSize(piece.slice(0, cut), size) > width
        ) {
          cut -= 1;
        }
        if (current) {
          lines.push(current);
          current = "";
        }
        lines.push(piece.slice(0, cut));
        piece = piece.slice(cut);
      }
      const candidate = current ? `${current} ${piece}` : piece;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
      } else {
        lines.push(current);
        current = piece;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  text(
    text: string,
    options: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      x?: number;
    } = {},
  ) {
    const size = options.size ?? 9;
    const font = options.bold ? this.bold : this.font;
    for (const line of this.wrap(
      text,
      CONTENT_WIDTH - (options.x ?? 0),
      font,
      size,
    )) {
      this.ensure(size + 3);
      this.y -= size;
      this.page.drawText(line, {
        x: MARGIN + (options.x ?? 0),
        y: this.y,
        size,
        font,
        color: options.color ?? INK,
      });
      this.y -= 3;
    }
  }

  gap(points: number) {
    this.y -= points;
  }

  heading(text: string) {
    this.ensure(30);
    this.gap(8);
    this.text(text, { size: 11, bold: true });
    this.gap(3);
  }

  private headerRow(columns: readonly Column[]) {
    const height = LINE + PAD * 2;
    this.ensure(height + LINE + PAD * 2);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - height,
      width: CONTENT_WIDTH,
      height,
      color: HEAD_FILL,
    });
    let x = MARGIN;
    for (const column of columns) {
      this.page.drawText(pdfSafe(column.header), {
        x: x + PAD,
        y: this.y - height + PAD + 2,
        size: 8,
        font: this.bold,
        color: rgb(1, 1, 1),
      });
      x += column.width;
    }
    this.y -= height;
  }

  table(columns: readonly Column[], rows: readonly (readonly string[])[]) {
    this.headerRow(columns);
    for (const row of rows) {
      const cells = row.map((cell, index) =>
        this.wrap(cell, columns[index].width - PAD * 2, this.font, 8),
      );
      const height =
        Math.max(...cells.map((lines) => lines.length)) * LINE + PAD * 2;
      if (this.y - height < BOTTOM) {
        this.newPage();
        this.headerRow(columns);
      }
      let x = MARGIN;
      cells.forEach((lines, index) => {
        const column = columns[index];
        lines.forEach((line, lineIndex) => {
          const width = this.font.widthOfTextAtSize(line, 8);
          this.page.drawText(line, {
            x:
              column.align === "right"
                ? x + column.width - PAD - width
                : x + PAD,
            y: this.y - PAD - 8 - lineIndex * LINE,
            size: 8,
            font: this.font,
            color: INK,
          });
        });
        x += column.width;
      });
      this.page.drawLine({
        start: { x: MARGIN, y: this.y - height },
        end: { x: MARGIN + CONTENT_WIDTH, y: this.y - height },
        thickness: 0.5,
        color: ROW_LINE,
      });
      this.y -= height;
    }
  }

  /** "Label ........" signature line. */
  signature(label: string, x: number, width: number) {
    this.page.drawLine({
      start: { x, y: this.y },
      end: { x: x + width, y: this.y },
      thickness: 0.6,
      color: MUTED,
    });
    this.page.drawText(pdfSafe(label), {
      x,
      y: this.y - 11,
      size: 8,
      font: this.font,
      color: MUTED,
    });
  }

  footers(note: string) {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      page.drawText(pdfSafe(note), {
        x: MARGIN,
        y: MARGIN - 4,
        size: 7,
        font: this.font,
        color: MUTED,
      });
      const label = `Page ${index + 1} of ${pages.length}`;
      page.drawText(label, {
        x: PAGE_WIDTH - MARGIN - this.font.widthOfTextAtSize(label, 7),
        y: MARGIN - 4,
        size: 7,
        font: this.font,
        color: MUTED,
      });
    });
  }
}

const number = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

/**
 * The Site Supervisor monthly report as a PDF in the layout of the company's form: itinerary,
 * overtime record, activity summary and the acknowledgement lines, with the headline figures
 * (sites visited, handovers signed, shootings) at the top.
 */
export async function renderSiteReportPdf(
  report: SiteMonthlyReport,
  extras: SiteReportPdfExtras,
): Promise<Uint8Array> {
  const w = await Writer.create();

  w.text("GQ PROJECTS SDN BHD", { size: 15, bold: true });
  w.text("SITE SUPERVISOR MONTHLY REPORT", { size: 12, bold: true });
  w.gap(4);
  w.text(`Name: ${report.name}`, { size: 10 });
  w.text(`Month / Year: ${extras.monthLabel}`, { size: 10 });
  w.text(extras.submittedNote, { size: 8, color: MUTED });

  w.heading("This month in figures");
  w.table(
    [
      { header: "Sites visited", width: 150, align: "right" },
      { header: "Handovers signed", width: 150, align: "right" },
      { header: "Photo / video shootings", width: 170, align: "right" },
      { header: "Total activities", width: 150, align: "right" },
      { header: "Overtime hours", width: CONTENT_WIDTH - 620, align: "right" },
    ],
    [
      [
        String(report.siteVisits),
        String(report.handoversSigned),
        String(report.shootings),
        String(report.totalActivities),
        number(report.overtimeHours),
      ],
    ],
  );

  w.heading("1. Itinerary & Activity Record");
  w.table(
    [
      { header: "No.", width: 30 },
      { header: "Date", width: 62 },
      { header: "Day", width: 34 },
      { header: "MOF No.", width: 62 },
      { header: "Project Name / Site", width: 210 },
      { header: "Activity", width: 80 },
      { header: "Details / Action Taken", width: CONTENT_WIDTH - 478 },
    ],
    report.itinerary.length === 0
      ? [["", "", "", "", "No site visits logged this month.", "", ""]]
      : report.itinerary.map((row) => [
          String(row.no),
          row.date,
          row.day,
          row.mofNo,
          row.site,
          row.activity,
          row.details,
        ]),
  );

  w.heading("2. Overtime / Night Work Record");
  w.table(
    [
      { header: "No.", width: 30 },
      { header: "Date", width: 62 },
      { header: "Project / Site & Reason", width: 300 },
      { header: "Time From", width: 60 },
      { header: "Time To", width: 60 },
      { header: "Hours", width: 45, align: "right" },
      { header: "Approved By", width: CONTENT_WIDTH - 557 },
    ],
    report.overtime.length === 0
      ? [["", "", "No overtime this month.", "", "", "", ""]]
      : report.overtime.map((row) => [
          String(row.no),
          row.workDate,
          `${row.mofNo} ${row.projectName}: ${row.reason}`,
          row.fromTime,
          row.toTime,
          number(row.hours),
          row.status === "approved"
            ? (row.approvedBy ?? "Approved")
            : "Waiting for approval",
        ]),
  );
  w.gap(3);
  w.text(`Total OT hours: ${number(report.overtimeHours)}`, { bold: true });

  w.heading("3. Monthly Activity Summary");
  w.table(
    [
      { header: "Activity", width: 200 },
      { header: "Count", width: 80, align: "right" },
    ],
    [
      ...report.summary.map((row) => [row.label, String(row.count)]),
      ["Total Activities", String(report.totalActivities)],
    ],
  );

  if (extras.supportNeeded || extras.nextMonthPlan) {
    w.heading("Notes from the supervisor");
    if (extras.supportNeeded) {
      w.text("Site issues and support needed", { bold: true });
      w.text(extras.supportNeeded);
      w.gap(4);
    }
    if (extras.nextMonthPlan) {
      w.text("Plan for next month", { bold: true });
      w.text(extras.nextMonthPlan);
    }
  }

  w.heading("4. Acknowledgement");
  w.ensure(60);
  w.gap(28);
  const third = (CONTENT_WIDTH - 40) / 3;
  w.signature(
    `Submitted by (Site Supervisor): ${report.name}   Signature / Date`,
    MARGIN,
    third,
  );
  w.signature(
    "Verified by (Admin / Operations)   Signature / Date",
    MARGIN + third + 20,
    third,
  );
  w.signature(
    "Approved by (Management)   Signature / Date",
    MARGIN + (third + 20) * 2,
    third,
  );

  w.footers(
    "Submit to Admin by the 3rd working day of the following month. OT must be approved before claim.",
  );
  return w.doc.save();
}
