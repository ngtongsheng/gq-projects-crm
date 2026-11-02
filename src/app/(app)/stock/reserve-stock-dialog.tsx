"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { STOCK_UNIT_LABEL, type StockUnit } from "@/lib/domain/reservation";
import { reserveStock } from "./actions";

type ItemOption = {
  id: string;
  label: string;
  available: number;
  unit: StockUnit;
};

/**
 * Salespeople ask for a hold; the people who arrange stock record it as already confirmed,
 * optionally for a salesperson.
 */
export function ReserveStockDialog({
  items,
  projects,
  salespeople,
  meId,
  confirmsDirectly,
}: {
  items: ItemOption[];
  projects: { id: string; label: string }[];
  /** Offered only to the people who arrange stock. */
  salespeople: { id: string; name: string }[];
  meId: string;
  confirmsDirectly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [itemId, setItemId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [reservedBy, setReservedBy] = useState(meId);
  const item = items.find((option) => option.id === itemId);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await reserveStock(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(
          confirmsDirectly
            ? "Stock reserved."
            : "Request sent. Stock will confirm it.",
        );
        setOpen(false);
        setItemId("");
        setProjectId("");
        setReservedBy(meId);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus data-icon="inline-start" />
          {confirmsDirectly ? "Reserve stock" : "Request a hold"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {confirmsDirectly ? "Reserve stock" : "Request a hold on stock"}
          </DialogTitle>
          <DialogDescription>
            {confirmsDirectly
              ? "Records the hold now. Email the supplier from the list afterwards."
              : "Whoever arranges stock checks it and confirms. You will see it turn to Reserved."}
          </DialogDescription>
        </DialogHeader>
        <form action={save}>
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="reservedBy" value={reservedBy} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reserveItem">Stock item</FieldLabel>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger id="reserveItem">
                  <SelectValue placeholder="Choose the SKU" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {item && (
                <FieldDescription>
                  {item.available.toLocaleString("en-MY")}{" "}
                  {STOCK_UNIT_LABEL[item.unit]} available.
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="reserveProject">Project</FieldLabel>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="reserveProject">
                  <SelectValue placeholder="Choose the project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projects.length === 0 && (
                <FieldDescription>
                  You have no projects yet. Stock is held for a project you own
                  or support.
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="reserveQty">
                Quantity{item ? ` (${STOCK_UNIT_LABEL[item.unit]})` : ""}
              </FieldLabel>
              <Input
                id="reserveQty"
                name="qty"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                required
              />
            </Field>
            {confirmsDirectly && (
              <Field>
                <FieldLabel htmlFor="reserveSalesperson">
                  Reserved for
                </FieldLabel>
                <Select value={reservedBy} onValueChange={setReservedBy}>
                  <SelectTrigger id="reserveSalesperson">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {salespeople.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="reserveNote">Note</FieldLabel>
              <Input
                id="reserveNote"
                name="note"
                maxLength={300}
                placeholder="e.g. Target to start in November"
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving..."
                : confirmsDirectly
                  ? "Reserve"
                  : "Send request"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
