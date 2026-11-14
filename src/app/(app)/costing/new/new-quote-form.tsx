"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { createQuote } from "../quote-actions";

export type ProjectChoice = {
  id: string;
  name: string;
  customerName: string;
};

/** Value of the "no project" item; Radix Select cannot hold an empty string. */
const NONE = "none";

export function NewQuoteForm({
  projects,
  initialProjectId,
  salespersonName,
}: {
  projects: ProjectChoice[];
  /** A project picked on its card; its names fill the form. */
  initialProjectId: string;
  salespersonName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initial = projects.find((project) => project.id === initialProjectId);
  const [projectId, setProjectId] = useState(initial?.id ?? NONE);
  const [projectName, setProjectName] = useState(initial?.name ?? "");
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");

  function pickProject(value: string) {
    setProjectId(value);
    const picked = projects.find((project) => project.id === value);
    if (!picked) return;
    setProjectName(picked.name);
    setCustomerName(picked.customerName);
  }

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await createQuote(formData);
      setError(result.error);
      if (result.error || !result.quoteId) return;
      toast.success(
        result.existing
          ? "That number already has a costing. Opened it."
          : "Costing started.",
      );
      router.push(`/costing/${result.quoteId}`);
    });
  }

  return (
    <form onSubmit={submitKeepingValues(save)} className="max-w-2xl">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="quoteNo">Quotation No.</FieldLabel>
          <Input
            id="quoteNo"
            name="quoteNo"
            placeholder="e.g. GQ5158"
            autoComplete="off"
            maxLength={60}
            required
          />
          <FieldDescription>
            Get the number from Zoho first, then key it in here. A number that
            already has a costing opens that costing.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="projectPicker">Link to a project</FieldLabel>
          <input
            type="hidden"
            name="projectId"
            value={projectId === NONE ? "" : projectId}
          />
          <Select value={projectId} onValueChange={pickProject}>
            <SelectTrigger id="projectPicker">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not linked to a project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            A linked project fills in the project and customer below.
          </FieldDescription>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="projectName">Project</FieldLabel>
            <Input
              id="projectName"
              name="projectName"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              maxLength={200}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="customerName">Customer</FieldLabel>
            <Input
              id="customerName"
              name="customerName"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              maxLength={200}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="salesperson">Salesperson</FieldLabel>
          <Input id="salesperson" value={salespersonName} disabled readOnly />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Starting..." : "Create costing"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
