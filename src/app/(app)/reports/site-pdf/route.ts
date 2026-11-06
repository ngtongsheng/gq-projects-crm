import type { NextRequest } from "next/server";
import { z } from "zod";
import { isManager } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { startOfMonth } from "@/lib/domain/calendar-grid";
import { formatDateTime, formatMonth, todayMyt } from "@/lib/format/date";
import { renderSiteReportPdf } from "@/lib/pdf/site-report-pdf";
import { loadMonthlyReport } from "../report-data";
import { loadSiteMonthlyReport } from "../site-report-data";

const query = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  person: z.uuid().optional(),
});

/** A readable file name without characters a download name cannot hold. */
const fileSafe = (text: string) =>
  text
    .replace(/[^A-Za-z0-9 _.-]/g, "")
    .trim()
    .replace(/\s+/g, " ") || "Report";

/**
 * The Site Supervisor monthly report as a PDF: ?month=2026-10 and, for a manager, ?person=. A
 * supervisor gets their own; the database limits what anyone else can read.
 */
export async function GET(request: NextRequest) {
  const me = await requireSection("reports");
  const parsed = query.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return new Response("Choose a month, like ?month=2026-10.", {
      status: 400,
    });
  }
  const month = `${parsed.data.month}-01`;
  if (month > startOfMonth(todayMyt())) {
    return new Response("That month has not started yet.", { status: 400 });
  }
  const personId = parsed.data.person ?? me.id;
  if (personId !== me.id && !isManager(me.jobRole)) {
    return new Response("You can only download your own report.", {
      status: 403,
    });
  }

  const team = await getTeamDirectory();
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const name = nameOf.get(personId) ?? "Unnamed";
  const [report, saved] = await Promise.all([
    loadSiteMonthlyReport(personId, name, month, nameOf),
    loadMonthlyReport(personId, month),
  ]);

  const bytes = await renderSiteReportPdf(report, {
    monthLabel: formatMonth(month),
    submittedNote: saved?.submittedAt
      ? `Submitted ${formatDateTime(saved.submittedAt)}`
      : "Not submitted yet",
    supportNeeded: saved?.supportNeeded ?? null,
    nextMonthPlan: saved?.nextMonthPlan ?? null,
  });

  const filename = `Site Supervisor Report - ${fileSafe(name)} - ${parsed.data.month}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
