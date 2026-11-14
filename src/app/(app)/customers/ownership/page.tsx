import { UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { formatDateTime } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { DecisionButtons } from "./decision-buttons";
import {
  canDecideOwnership,
  canOpenOwnershipRequests,
} from "./ownership-access";

export const metadata: Metadata = { title: "Ownership requests" };

const RequestStatus = z.enum(["pending", "approved", "rejected"]);
type RequestStatus = z.infer<typeof RequestStatus>;

const statusLabel: Record<RequestStatus, string> = {
  pending: "Waiting",
  approved: "Approved",
  rejected: "Rejected",
};

const statusTone: Record<RequestStatus, StatusTone> = {
  pending: "warn",
  approved: "good",
  rejected: "bad",
};

const requestRows = z.array(
  z.object({
    id: z.string(),
    reason: z.string(),
    status: RequestStatus,
    requested_by: z.string(),
    decided_by: z.string().nullable(),
    decided_at: z.string().nullable(),
    created_at: z.string(),
    contacts: z.object({
      id: z.string(),
      name: z.string(),
      companies: z.object({ name: z.string() }),
      contact_owners: z.array(z.object({ profile_id: z.string() })),
    }),
  }),
);

export default async function OwnershipRequestsPage() {
  const me = await requirePage("cust");
  const canDecide = canDecideOwnership(me.jobRole);
  const supabase = await createClient();

  const [requestsResult, team] = await Promise.all([
    supabase
      .from("ownership_requests")
      .select(
        "id, reason, status, requested_by, decided_by, decided_at, created_at, contacts(id, name, companies(name), contact_owners(profile_id))",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    getTeamDirectory(),
  ]);
  if (requestsResult.error) {
    throw new Error(
      `Could not load ownership requests: ${requestsResult.error.message}`,
    );
  }
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const personName = (id: string) => nameOf.get(id) ?? "Unnamed";

  const rows = requestRows.parse(requestsResult.data).map((row) => ({
    id: row.id,
    contactId: row.contacts.id,
    customer: row.contacts.name,
    company: row.contacts.companies.name,
    owners: row.contacts.contact_owners.map((owner) =>
      personName(owner.profile_id),
    ),
    requestedBy: personName(row.requested_by),
    reason: row.reason,
    status: row.status,
    requestedAt: formatDateTime(row.created_at),
    decidedBy: row.decided_by ? personName(row.decided_by) : null,
    decidedAt: row.decided_at ? formatDateTime(row.decided_at) : null,
  }));
  // Waiting requests first, newest decisions after them.
  const waiting = rows.filter((row) => row.status === "pending");
  const decided = rows.filter((row) => row.status !== "pending");
  const ordered = [...waiting.reverse(), ...decided];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={canDecide ? "Ownership requests" : "My requests"}
        description={
          canDecide
            ? `${waiting.length} waiting. Approving makes the requester the owner of the customer.`
            : canOpenOwnershipRequests(me.jobRole)
              ? "Customers you asked to own, and what was decided."
              : "Ownership requests across the team."
        }
      />
      <DataTable
        rows={ordered}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={UserCheck}
            title="No requests"
            description={
              canDecide
                ? "When a salesperson keys in a mobile number someone else owns, they can ask you to review it here."
                : "Use Request ownership on a customer someone else owns."
            }
          />
        }
        columns={[
          {
            key: "customer",
            header: "Customer",
            cell: (row) => (
              <div className="flex flex-col">
                <Link
                  href={`/customers/${row.contactId}`}
                  className="font-medium hover:underline"
                >
                  {row.customer}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {row.company}
                </span>
              </div>
            ),
          },
          {
            key: "from",
            header: "Asked by",
            cell: (row) => (
              <div className="flex flex-col">
                <span>{row.requestedBy}</span>
                <span className="text-xs text-muted-foreground">
                  {row.requestedAt}
                </span>
              </div>
            ),
          },
          {
            key: "owners",
            header: "Now with",
            cell: (row) => row.owners.join(" + ") || "–",
          },
          {
            key: "reason",
            header: "Reason",
            cell: (row) => (
              <span className="whitespace-normal">{row.reason}</span>
            ),
          },
          {
            key: "status",
            header: "Outcome",
            cell: (row) =>
              row.status === "pending" && canDecide ? (
                <DecisionButtons requestId={row.id} />
              ) : (
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge tone={statusTone[row.status]}>
                    {statusLabel[row.status]}
                  </StatusBadge>
                  {row.decidedBy && row.decidedAt && (
                    <span className="text-xs text-muted-foreground">
                      {row.decidedBy}, {row.decidedAt}
                    </span>
                  )}
                </div>
              ),
          },
        ]}
      />
    </div>
  );
}
