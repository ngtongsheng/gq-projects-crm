import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { recordHref } from "../today/record-link";
import type { SiteJob } from "./site-jobs-data";

/** New MOFs nobody has visited yet. Whoever can log a visit gets a button to start with the first. */
export function NewMofBanner({
  jobs,
  today,
  nameOf,
  canLog,
  t,
}: {
  jobs: readonly SiteJob[];
  today: string;
  nameOf: (personId: string) => string;
  canLog: boolean;
  t: Translate;
}) {
  const [first] = jobs;
  if (!first) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-warn-bg p-4 text-sm text-warn">
      <p className="min-w-64 flex-1">
        <b>
          {jobs.length}{" "}
          {t(jobs.length === 1 ? "new MOF needs" : "new MOFs need")}{" "}
          {t("a first site visit:")}
        </b>{" "}
        {jobs
          .map(
            (job) =>
              `${job.mofNo} ${job.projectName} (${nameOf(job.salespersonId)}, ${t("registered")} ${formatDate(job.registeredOn)})`,
          )
          .join(" · ")}
      </p>
      {canLog && (
        <Button asChild size="sm" variant="outline">
          <Link href={recordHref(today, { mofId: first.id })}>
            {t("Log first visit")}
          </Link>
        </Button>
      )}
    </div>
  );
}
