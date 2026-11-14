import { Calculator } from "lucide-react";
import type { Metadata } from "next";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { canStartQuote } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { createClient } from "@/lib/supabase/server";
import { NewQuoteForm, type ProjectChoice } from "./new-quote-form";

export const metadata: Metadata = { title: "New costing" };

const projectRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    contacts: z.object({ companies: z.object({ name: z.string() }) }),
  }),
);

async function loadProjectChoices(): Promise<ProjectChoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, contacts(companies(name))")
    .order("name");
  if (error) throw new Error(`Could not load projects: ${error.message}`);
  return projectRows.parse(data).map((row) => ({
    id: row.id,
    name: row.name,
    customerName: row.contacts.companies.name,
  }));
}

export default async function NewCostingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("cost");
  if (!canStartQuote(me.jobRole)) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="New costing" />
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Calculator}
            title="Salespeople start the costings"
            description="Your role does not start a costing. Open the Costing Register to see them."
          />
        </div>
      </div>
    );
  }
  const { project } = await searchParams;
  const projects = await loadProjectChoices();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New costing"
        description="Key in the quotation number from Zoho to start. You add the products next."
      />
      <NewQuoteForm
        key={typeof project === "string" ? project : ""}
        projects={projects}
        initialProjectId={typeof project === "string" ? project : ""}
        salespersonName={me.fullName ?? "Unnamed"}
      />
    </div>
  );
}
