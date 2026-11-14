"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  type AccessKey,
  type AccessOverrides,
  accessAllowed,
  defaultAllowed,
  MATRIX_ROWS,
  type RoleKey,
} from "@/lib/auth/pages";
import { cn } from "@/lib/utils";
import { resetRoleAccess, setRoleAccess } from "./role-access-actions";

type EditableRole = Exclude<RoleKey, "md">;

// The demo's People columns (ROLE_OPTS), in its order.
const COLUMNS: readonly { key: EditableRole; label: string }[] = [
  { key: "sales", label: "Salesperson" },
  { key: "designer", label: "Designer" },
  { key: "marketing", label: "Marketing Executive" },
  { key: "ssup", label: "Sales support" },
  { key: "arrange", label: "Salesperson + sales support" },
  { key: "site", label: "Site supervisor" },
  { key: "support", label: "Purchasing / delivery" },
  { key: "accounts", label: "HR & Accounts" },
  { key: "director", label: "Sales Director" },
  { key: "bd", label: "Marketing Director" },
];

type RoleAccessProps = {
  overrides: AccessOverrides;
  /** Names of the active people in each role, shown under the role. */
  people: Partial<Record<RoleKey, string[]>>;
};

/** "What each role can see": the MD ticks a page to show it to a role, unticks to hide it. */
export function RoleAccess({ overrides, people }: RoleAccessProps) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string | null }>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else toast.success(done);
    });
  }

  function cell(roleKey: EditableRole, key: AccessKey, label: string) {
    const allowed = accessAllowed(roleKey, key, overrides);
    const changed = allowed !== defaultAllowed(roleKey, key);
    const role = COLUMNS.find((column) => column.key === roleKey)?.label;
    return (
      <span
        className={cn("inline-flex rounded-md p-1.5", changed && "bg-warn-bg")}
      >
        <Checkbox
          checked={allowed}
          disabled={pending}
          aria-label={`${label} for ${role}`}
          onCheckedChange={(next) =>
            run(
              () => setRoleAccess({ roleKey, key, allowed: next === true }),
              `${next === true ? "Shown" : "Hidden"} for ${role}`,
            )
          }
        />
      </span>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="font-heading text-lg font-semibold">
          What each role can see
        </h2>
        <span className="text-sm text-muted-foreground">
          Tick to show a page, untick to hide it
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          disabled={pending}
          onClick={() => run(resetRoleAccess, "Back to default")}
        >
          Back to default
        </Button>
      </div>
      <div className="overflow-x-auto">
        <DataTable
          rows={[...MATRIX_ROWS]}
          getRowKey={(row) => row.key}
          columns={[
            { key: "page", header: "Page", cell: (row) => row.label },
            ...COLUMNS.map((column) => ({
              key: column.key,
              header: (
                <span className="flex flex-col items-center gap-0.5 normal-case">
                  <span>{column.label}</span>
                  <span className="font-normal tracking-normal">
                    {people[column.key]?.join(", ") || "nobody yet"}
                  </span>
                </span>
              ),
              cell: (row: (typeof MATRIX_ROWS)[number]) => (
                <span className="flex justify-center">
                  {cell(column.key, row.key, row.label)}
                </span>
              ),
            })),
            {
              key: "md",
              header: "Managing Director",
              cell: () => (
                <span className="block text-center text-muted-foreground">
                  Always
                </span>
              ),
            },
          ]}
        />
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        Changes apply straight away to everyone with that role. Shaded boxes are
        changed from the default. &ldquo;See margin %&rdquo; lets that role see
        margin and cost figures. The People page and this table are only for the
        Managing Director.
      </p>
    </section>
  );
}
