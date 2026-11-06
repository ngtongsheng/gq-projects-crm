import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  buildSiteMonthlyReport,
  type ItineraryLog,
} from "@/lib/domain/site-monthly-report";
import { pdfSafe, renderSiteReportPdf } from "./site-report-pdf";

const extras = {
  monthLabel: "October 2026",
  submittedNote: "Submitted 3 Nov 2026, 09:12",
  supportNeeded: null,
  nextMonthPlan: null,
};

const log = (
  day: number,
  activity: ItineraryLog["activity"],
): ItineraryLog => ({
  visitedOn: `2026-10-${String(day).padStart(2, "0")}`,
  mofNo: `P15${day}`,
  projectName:
    "A very long project name that needs to wrap onto more than one line in the table",
  activity,
  notes:
    "Checked the floor, photographed every room and agreed the touch up list with the client.",
  handoverSigned: activity === "handover",
});

describe("renderSiteReportPdf", () => {
  it("makes a PDF with the report's pages", async () => {
    const report = buildSiteMonthlyReport({
      name: "Raj Kumar",
      month: "2026-10-01",
      logs: [log(2, "measurement"), log(5, "handover"), log(9, "shooting")],
      claims: [],
    });

    const bytes = await renderSiteReportPdf(report, extras);

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeLessThanOrEqual(2);
  });

  it("runs on to more pages for a long itinerary and still has a first page of headings", async () => {
    const logs = Array.from({ length: 28 }, (_, index) =>
      log((index % 27) + 1, "inspection"),
    );
    const report = buildSiteMonthlyReport({
      name: "Raj Kumar",
      month: "2026-10-01",
      logs,
      claims: [],
    });

    const pdf = await PDFDocument.load(
      await renderSiteReportPdf(report, extras),
    );

    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("does not fail on names the standard fonts cannot draw", async () => {
    const report = buildSiteMonthlyReport({
      name: "李明 Awaludin",
      month: "2026-10-01",
      logs: [{ ...log(2, "others"), projectName: "客户 Site ✓" }],
      claims: [],
    });

    const bytes = await renderSiteReportPdf(report, extras);

    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("handles a month with nothing logged", async () => {
    const report = buildSiteMonthlyReport({
      name: "Raj Kumar",
      month: "2026-10-01",
      logs: [],
      claims: [],
    });

    const pdf = await PDFDocument.load(
      await renderSiteReportPdf(report, extras),
    );

    expect(pdf.getPageCount()).toBeLessThanOrEqual(2);
  });
});

describe("pdfSafe", () => {
  it("keeps Western text and swaps what the fonts cannot draw", () => {
    expect(pdfSafe("Café m² – ok")).toBe("Café m² – ok");
    expect(pdfSafe("“quoted” text…")).toBe('"quoted" text...');
    expect(pdfSafe("客户 A")).toBe("?? A");
    expect(pdfSafe("line\nbreak")).toBe("line break");
  });
});
