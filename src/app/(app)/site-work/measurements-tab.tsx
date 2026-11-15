import { Ruler } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import type { Profile } from "@/lib/auth/current-profile";
import { measurementStatus } from "@/lib/domain/site-log-status";
import { canReceiveMeasurement } from "@/lib/domain/site-photos";
import { formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { LogStatusBadge } from "./log-status-text";
import { ReceivedButton } from "./row-action-buttons";
import {
  loadMeasurements,
  type SiteMeasurement,
} from "./site-measurements-data";
import { SubText } from "./sub-text";

/**
 * Site measurements: the supervisor logs a measurement visit and says it went to the
 * salesperson, who taps Received (demo: siteMeas).
 */
export async function MeasurementsTab({
  me,
  nameOf,
  t,
}: {
  me: Profile;
  nameOf: (personId: string) => string;
  t: Translate;
}) {
  const measurements = await loadMeasurements();
  const notSubmitted = measurements.filter((row) => !row.sentOn).length;
  const waiting = measurements.filter(
    (row) => row.sentOn && !row.received,
  ).length;
  const name = (personId: string | null) =>
    personId ? nameOf(personId) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-heading text-lg font-semibold">
          {t("Site measurements")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {`${notSubmitted} ${t("not submitted")} · ${waiting} ${t("waiting for salesperson")}`}
        </span>
      </div>
      <DataTable
        rows={measurements}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState icon={Ruler} title={t("No site measurements yet.")} />
        }
        columns={[
          {
            key: "measured",
            header: t("Measured"),
            className: "whitespace-nowrap",
            cell: (row: SiteMeasurement) => (
              <>
                <span className="font-mono">{formatDate(row.visitedOn)}</span>
                <SubText>{nameOf(row.supervisorId)}</SubText>
              </>
            ),
          },
          {
            key: "site",
            header: t("MOF · Project / site"),
            cell: (row) => (
              <>
                {row.mofId ? (
                  <Link
                    href={`/site-work/${row.mofId}`}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    {row.mofNo}
                  </Link>
                ) : (
                  <span className="font-semibold">–</span>
                )}
                <SubText>
                  {[row.siteLabel, row.details].filter(Boolean).join(" · ")}
                </SubText>
              </>
            ),
          },
          {
            key: "for",
            header: t("For"),
            className: "max-sm:hidden",
            cell: (row) => name(row.toId) ?? "–",
          },
          {
            key: "status",
            header: t("Status"),
            cell: (row) => (
              <LogStatusBadge
                t={t}
                status={measurementStatus({
                  to: name(row.toId),
                  sentOn: row.sentOn,
                  received: row.received,
                  receivedOn: row.receivedOn,
                })}
              />
            ),
          },
          {
            key: "action",
            header: "",
            cell: (row) =>
              row.sentOn &&
              !row.received &&
              canReceiveMeasurement(me, row) && (
                <ReceivedButton siteLogId={row.id} />
              ),
          },
        ]}
      />
      <p className="text-sm text-muted-foreground">
        {t(
          "The site supervisor logs a Measurement visit and says it went to the salesperson. The salesperson taps Received.",
        )}
      </p>
    </div>
  );
}
