"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  isSupplierPoOverdue,
  SUPPLIER_PO_STATUS_LABEL,
  SUPPLIER_PO_STATUS_TONE,
  SUPPLIER_PO_STATUSES,
  type SupplierPoStatus,
  supplierPoEta,
  supplierPoNumber,
} from "@/lib/domain/supplier-po";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { formatDate } from "@/lib/format/date";
import { saveSupplierPo } from "../supplier-po-actions";

export type SupplierPoRow = {
  id: string;
  zohoNo: string;
  supplier: string;
  poDate: string;
  leadTimeDays: number;
  status: SupplierPoStatus;
  notes: string;
};

type SupplierPosProps = {
  mofId: string;
  mofNo: string;
  pos: SupplierPoRow[];
  /** Why the MOF needs a supplier PO, or null when it does not. */
  reason: string | null;
  canEdit: boolean;
  /** Malaysia date, so the late flag matches the server. */
  today: string;
  /** Suppliers already named on the MOF's product lines. */
  supplierSuggestions: string[];
};

type DialogProps = {
  mofId: string;
  mofNo: string;
  po?: SupplierPoRow;
  supplierSuggestions: string[];
};

/** Radix unmounts the content on close, so each opening starts from the saved values. */
function SupplierPoDialog(props: DialogProps) {
  const [open, setOpen] = useState(false);
  const { po, mofNo } = props;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {po ? (
          <Button size="sm" variant="outline">
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus data-icon="inline-start" />
            Add supplier PO
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {po
              ? `Update PO ${supplierPoNumber(mofNo, po.zohoNo)}`
              : "Add supplier PO"}
          </DialogTitle>
          <DialogDescription>
            ETA = PO date + lead time. Change the lead time when the supplier
            confirms a new date.
          </DialogDescription>
        </DialogHeader>
        <SupplierPoForm {...props} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SupplierPoForm({
  mofId,
  mofNo,
  po,
  supplierSuggestions,
  onSaved,
}: DialogProps & { onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [poDate, setPoDate] = useState(po?.poDate ?? "");
  const [leadTime, setLeadTime] = useState(String(po?.leadTimeDays ?? 21));
  const listId = `suppliers-${po?.id ?? "new"}`;

  const leadDays = /^\d{1,4}$/.test(leadTime) ? Number(leadTime) : null;
  const eta =
    poDate !== "" && leadDays !== null ? supplierPoEta(poDate, leadDays) : null;

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveSupplierPo(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(po ? "Supplier PO saved." : "Supplier PO added.");
        onSaved();
      }
    });
  }

  return (
    <form onSubmit={submitKeepingValues(save)}>
      <input type="hidden" name="mofId" value={mofId} />
      {po && <input type="hidden" name="poId" value={po.id} />}
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="zohoNo">PO no.</FieldLabel>
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium">{mofNo}</span>
              <Input
                id="zohoNo"
                name="zohoNo"
                className="font-mono"
                inputMode="numeric"
                maxLength={4}
                placeholder="2210"
                defaultValue={po?.zohoNo}
                required
              />
            </div>
            <FieldDescription>
              The 4-digit running no. from Zoho.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="supplier">Supplier</FieldLabel>
            <Input
              id="supplier"
              name="supplier"
              list={listId}
              defaultValue={po?.supplier}
              maxLength={100}
              required
            />
            <datalist id={listId}>
              {supplierSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="poDate">PO date</FieldLabel>
            <Input
              id="poDate"
              name="poDate"
              type="date"
              value={poDate}
              onChange={(event) => setPoDate(event.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="leadTimeDays">Lead time (days)</FieldLabel>
            <Input
              id="leadTimeDays"
              name="leadTimeDays"
              inputMode="numeric"
              className="font-mono"
              value={leadTime}
              onChange={(event) => setLeadTime(event.target.value)}
              required
            />
            <FieldDescription>
              ETA:{" "}
              <span className="font-mono tabular-nums">
                {eta ? formatDate(eta) : "–"}
              </span>
            </FieldDescription>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <Select name="status" defaultValue={po?.status ?? "ordered"}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPLIER_PO_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {SUPPLIER_PO_STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Input
            id="notes"
            name="notes"
            placeholder="e.g. Vessel delayed one week"
            defaultValue={po?.notes}
            maxLength={300}
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save supplier PO"}
        </Button>
      </FieldGroup>
    </form>
  );
}

/** The MOF's supplier POs. Purchasing adds them only while the MOF needs one; existing ones stay editable. */
export function SupplierPos({
  mofId,
  mofNo,
  pos,
  reason,
  canEdit,
  today,
  supplierSuggestions,
}: SupplierPosProps) {
  const needed = reason !== null;
  const dialog = { mofId, mofNo, supplierSuggestions };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <CardTitle className="font-heading">Supplier POs</CardTitle>
          <span className="text-sm text-muted-foreground">
            {needed
              ? reason
              : "Not needed: ex stock and a small order. Supplier POs stay in Zoho."}
          </span>
        </div>
        {canEdit && needed && <SupplierPoDialog {...dialog} />}
      </CardHeader>
      <CardContent>
        <DataTable
          rows={pos}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              title={needed ? "No supplier PO yet" : "Nothing to track"}
              description={
                needed
                  ? "Add the PO once it is issued in Zoho."
                  : "Supplier POs for this order are kept in Zoho."
              }
            />
          }
          columns={[
            {
              key: "poNo",
              header: "PO no.",
              cell: (row) => (
                <span className="font-mono font-medium">
                  {supplierPoNumber(mofNo, row.zohoNo)}
                </span>
              ),
            },
            {
              key: "supplier",
              header: "Supplier",
              cell: (row) => row.supplier,
            },
            {
              key: "poDate",
              header: "PO date",
              numeric: true,
              cell: (row) => formatDate(row.poDate),
            },
            {
              key: "lead",
              header: "Lead time",
              numeric: true,
              cell: (row) => `${row.leadTimeDays} days`,
            },
            {
              key: "eta",
              header: "ETA",
              numeric: true,
              cell: (row) =>
                formatDate(supplierPoEta(row.poDate, row.leadTimeDays)),
            },
            {
              key: "status",
              header: "Status",
              cell: (row) => (
                <div className="flex flex-wrap gap-1">
                  <StatusBadge tone={SUPPLIER_PO_STATUS_TONE[row.status]}>
                    {SUPPLIER_PO_STATUS_LABEL[row.status]}
                  </StatusBadge>
                  {isSupplierPoOverdue(row, today) && (
                    <StatusBadge tone="bad">Late</StatusBadge>
                  )}
                </div>
              ),
            },
            {
              key: "notes",
              header: "Notes",
              cell: (row) => row.notes || "–",
            },
            ...(canEdit
              ? [
                  {
                    key: "edit",
                    header: "",
                    cell: (row: SupplierPoRow) => (
                      <SupplierPoDialog {...dialog} po={row} />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </CardContent>
    </Card>
  );
}
