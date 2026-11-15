"use client";

import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActivityForm } from "@/app/(app)/activities/activity-form";
import {
  ActivityStatusLabel,
  ActivityTypeLabel,
} from "@/app/(app)/activities/schemas";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/format/date";
import type { CompanyDetail } from "./company-detail";
import { CompanyEditDialog } from "./company-edit-dialog";
import { ContactDialog } from "./contact-form";
import { CustomerHealthBadge } from "./customer-health-badge";
import { AccountTypeLabel, CompanyTypeLabel, RatingLabel } from "./schemas";

type CompanySheetProps = {
  detail: CompanyDetail;
  /** Every company, for the Add person form's company list. */
  companies: { id: string; name: string; rating: number }[];
  /** The customers address without the company; closing goes back to it. */
  closeHref: string;
  canSetAccountType: boolean;
  canRateCompany: boolean;
};

const commissionText = (detail: CompanyDetail) => {
  const { accountType, passedBy } = detail.company;
  if (!accountType) return "Not fixed";
  if (accountType !== "pass_down") return AccountTypeLabel[accountType];
  const passer = detail.team.find((member) => member.id === passedBy)?.name;
  return `${AccountTypeLabel[accountType]}${passer ? ` by ${passer}` : ""}`;
};

/** Open whenever the address carries a company; closing drops it again. */
export function CompanySheet({
  detail,
  companies,
  closeHref,
  canSetAccountType,
  canRateCompany,
}: CompanySheetProps) {
  const router = useRouter();
  const { company, people, visits } = detail;

  return (
    <Sheet open onOpenChange={(open) => !open && router.replace(closeHref)}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{company.name}</SheetTitle>
          <SheetDescription>
            {CompanyTypeLabel[company.companyType]} · {company.rating} ·{" "}
            {RatingLabel[company.rating]} · Commission: {commissionText(detail)}
            {detail.salespeopleNames.length > 0 &&
              ` · Salespeople: ${detail.salespeopleNames.join(" + ")}`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {detail.canLogVisit && (
              <LogVisitDialog
                people={people.map((person) => ({
                  id: person.id,
                  label: person.name,
                }))}
                companyName={company.name}
              />
            )}
            {detail.canAddPerson && (
              <ContactDialog
                companies={companies}
                team={detail.team}
                defaultCompanyId={company.id}
                canSetAccountType={canSetAccountType}
                canRateCompany={canRateCompany}
                canRequestOwnership={false}
              />
            )}
            {detail.canEdit && (
              <CompanyEditDialog company={company} team={detail.team} />
            )}
          </div>
          <section className="flex flex-col gap-2">
            <h3 className="font-heading text-sm font-medium">
              People ({people.length})
            </h3>
            {people.length === 0 ? (
              <p className="text-sm text-muted-foreground">No people yet.</p>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border">
                {people.map((person) => (
                  <li key={person.id} className="flex flex-col gap-0.5 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/customers/${person.id}`}
                        className="font-medium hover:underline"
                      >
                        {person.name}
                      </Link>
                      <CustomerHealthBadge health={person.health} />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {person.title ?? "–"} ·{" "}
                      <span className="font-mono tabular-nums">
                        {person.mobile}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {person.ownerNames.join(" + ") || "No owner"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="font-heading text-sm font-medium">
              Visits ({detail.visitCount})
            </h3>
            {visits.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border">
                {visits.map((visit) => (
                  <li key={visit.id} className="flex flex-col gap-0.5 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium tabular-nums">
                        {formatDate(visit.day)}
                      </span>
                      <span>
                        {visit.ownerName} · {ActivityTypeLabel[visit.type]}
                      </span>
                      {visit.status === "planned" && (
                        <StatusBadge tone="info">
                          {ActivityStatusLabel[visit.status]}
                        </StatusBadge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Met {visit.personName} · {visit.purpose}
                      {visit.outcome && ` → ${visit.outcome}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LogVisitDialog({
  people,
  companyName,
}: {
  people: { id: string; label: string }[];
  companyName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CalendarPlus data-icon="inline-start" />
          Log visit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log visit</DialogTitle>
          <DialogDescription>
            At {companyName}. Times are Malaysia time.
          </DialogDescription>
        </DialogHeader>
        <ActivityForm customers={people} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
