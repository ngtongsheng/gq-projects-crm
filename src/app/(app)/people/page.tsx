import { Users } from "lucide-react";
import type { Metadata } from "next";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth/require-role";
import {
  ADMIN_UNAVAILABLE_MESSAGE,
  createAdminClient,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AddPersonDialog } from "./add-person-dialog";
import { RoleSelect } from "./role-select";
import { roleSchema } from "./schemas";

export const metadata: Metadata = { title: "People" };

const joinedFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

/** Emails live in the auth system, which only the service key can read. */
async function emailsById(): Promise<Map<string, string> | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Could not load emails: ${error.message}`);
  return new Map(data.users.map((user) => [user.id, user.email ?? ""]));
}

export default async function PeoplePage() {
  const me = await requireRole("admin");
  const supabase = await createClient();

  const [{ data: profiles, error }, emails] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("created_at"),
    emailsById(),
  ]);
  if (error) throw new Error(`Could not load people: ${error.message}`);

  const rows = profiles.map((row) => ({
    id: row.id,
    name: row.full_name,
    email: emails?.get(row.id) ?? null,
    role: roleSchema.parse(row.role),
    joined: new Date(row.created_at),
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="People"
        description={
          emails
            ? undefined
            : "Emails and adding people work on the preview link or the live site."
        }
        actions={
          <AddPersonDialog
            unavailableMessage={emails ? null : ADMIN_UNAVAILABLE_MESSAGE}
          />
        }
      />
      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        empty={<EmptyState icon={Users} title="No people yet" />}
        columns={[
          {
            key: "name",
            header: "Name",
            cell: (row) => row.name ?? "–",
          },
          {
            key: "email",
            header: "Email",
            cell: (row) => row.email ?? "–",
          },
          {
            key: "role",
            header: "Role",
            cell: (row) => (
              <RoleSelect
                userId={row.id}
                role={row.role}
                isSelf={row.id === me.id}
              />
            ),
          },
          {
            key: "joined",
            header: "Joined",
            numeric: true,
            cell: (row) => joinedFormat.format(row.joined),
          },
        ]}
      />
    </div>
  );
}
