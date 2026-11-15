"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { SITE_STAGE_LABEL } from "@/lib/domain/site-stage";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { formatDate, todayMyt } from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import { saveVariationOrder } from "./vo-actions";

export type VariationOrderRow = {
  id: string;
  voNo: string;
  clientRef: string;
  confirmedOn: string;
  amount: number;
  description: string;
  qty: string;
  needsWork: boolean;
  /** Null when not costed, or when the viewer may not see cost. */
  cost: number | null;
  alerts: { supervisorId: string; notedAt: string | null }[];
};

type Person = { id: string; name: string };

type VoSheetProps = {
  mofId: string;
  mofNo: string;
  contractSum: number;
  vos: VariationOrderRow[];
  canEdit: boolean;
  showCost: boolean;
  /** The site marked the job 100% completed. */
  jobCompleted: boolean;
  supervisors: Person[];
  /** The job's own supervisors, ticked to be told when a VO reopens it. */
  jobSupervisorIds: string[];
  /** Malaysia date, the default confirmation date. */
  today: string;
};

type DialogProps = Omit<VoSheetProps, "vos" | "canEdit"> & {
  vo?: VariationOrderRow;
  nextVoNo: string;
  voTotal: number;
  voCount: number;
};

const amountText = (amount: number) => (amount === 0 ? "0" : String(amount));

/** Radix unmounts the content on close, so each opening starts from the saved values. */
function VoDialog(props: DialogProps) {
  const [open, setOpen] = useState(false);
  const { vo, mofNo, contractSum, voTotal, voCount } = props;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {vo ? (
          <Button size="sm" variant="outline">
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus data-icon="inline-start" />
            Add VO
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {vo ? `Edit ${vo.voNo}` : "Add variation order"} · {mofNo}
          </DialogTitle>
          <DialogDescription>
            Contract {formatRm(contractSum)}
            {voCount > 0 && ` · VOs so far ${formatRm(voTotal)}`}. A VO stays
            under the same MOF; its value counts as sales in the month it is
            confirmed.
          </DialogDescription>
        </DialogHeader>
        <VoForm {...props} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function VoForm({
  mofId,
  vo,
  nextVoNo,
  showCost,
  jobCompleted,
  supervisors,
  jobSupervisorIds,
  today,
  onSaved,
}: DialogProps & { onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Only a new VO reopens a completed job.
  const reopens = !vo && jobCompleted;
  const ticked =
    jobSupervisorIds.length > 0
      ? jobSupervisorIds
      : supervisors.map((person) => person.id);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveVariationOrder(formData);
      setError(result.error);
      if (result.error) return;
      const voNo = String(formData.get("voNo")).trim();
      toast.success(
        result.reopened
          ? `${voNo} saved. The job is open again for the site team.`
          : `${voNo} saved.`,
      );
      onSaved();
    });
  }

  return (
    <form onSubmit={submitKeepingValues(save)}>
      <input type="hidden" name="mofId" value={mofId} />
      {vo && <input type="hidden" name="voId" value={vo.id} />}
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="voNo">VO no.</FieldLabel>
            <Input
              id="voNo"
              name="voNo"
              className="font-mono"
              defaultValue={vo?.voNo ?? nextVoNo}
              maxLength={30}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="clientRef">Client VO / PO ref.</FieldLabel>
            <Input
              id="clientRef"
              name="clientRef"
              placeholder="e.g. VO-03 / PO 22981"
              defaultValue={vo?.clientRef}
              maxLength={100}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="confirmedOn">Date confirmed</FieldLabel>
            <Input
              id="confirmedOn"
              name="confirmedOn"
              type="date"
              defaultValue={vo?.confirmedOn ?? today}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="amount">Amount (RM)</FieldLabel>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              className="font-mono tabular-nums"
              defaultValue={vo ? amountText(vo.amount) : ""}
              required
            />
            <FieldDescription>Negative for an omission.</FieldDescription>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="description">What is it</FieldLabel>
          <Input
            id="description"
            name="description"
            placeholder="e.g. Extra carpet tile for pantry"
            defaultValue={vo?.description}
            maxLength={300}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="qty">Additional area / qty</FieldLabel>
          <Input
            id="qty"
            name="qty"
            placeholder="e.g. 120 m² · 30 boxes"
            defaultValue={vo?.qty}
            maxLength={100}
          />
        </Field>
        {showCost && (
          <Field>
            <FieldLabel htmlFor="cost">Cost of this VO (RM)</FieldLabel>
            <Input
              id="cost"
              name="cost"
              inputMode="decimal"
              className="font-mono tabular-nums"
              defaultValue={vo?.cost === null || !vo ? "" : String(vo.cost)}
            />
            <FieldDescription>For margin.</FieldDescription>
          </Field>
        )}
        <Field orientation="horizontal">
          <Checkbox
            id="needsWork"
            name="needsWork"
            defaultChecked={vo ? vo.needsWork : true}
          />
          <FieldLabel htmlFor="needsWork" className="font-normal">
            Needs delivery / installation
          </FieldLabel>
        </Field>
        {reopens && (
          <div className="flex flex-col gap-3 rounded-lg border bg-warn-bg p-3 text-sm">
            <p className="font-medium text-warn">
              Site supervisor marked this job 100% completed.
            </p>
            <p>
              Saving with &ldquo;Needs delivery / installation&rdquo; ticked
              reopens the job at &ldquo;{SITE_STAGE_LABEL.installation}&rdquo;,
              so it shows again in the site supervisor&rsquo;s list.
            </p>
            <Field>
              <FieldLabel>Tell site supervisor</FieldLabel>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {supervisors.map((person) => (
                  <Label key={person.id} className="font-normal">
                    <Checkbox
                      name="notifyId"
                      value={person.id}
                      defaultChecked={ticked.includes(person.id)}
                    />
                    {person.name}
                  </Label>
                ))}
              </div>
            </Field>
          </div>
        )}
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save VO"}
        </Button>
      </FieldGroup>
    </form>
  );
}

/** Who was told about a VO's additional work, and whether each has noted it. */
function AlertStatus({
  alerts,
  nameOf,
}: {
  alerts: VariationOrderRow["alerts"];
  nameOf: Map<string, string>;
}) {
  if (alerts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {alerts.map((alert) => (
        <StatusBadge
          key={alert.supervisorId}
          tone={alert.notedAt ? "good" : "warn"}
        >
          {nameOf.get(alert.supervisorId) ?? "Unnamed"}:{" "}
          {alert.notedAt
            ? `noted ${formatDate(todayMyt(new Date(alert.notedAt)))}`
            : "not seen yet"}
        </StatusBadge>
      ))}
    </div>
  );
}

/** The MOF's variation orders. The register editors add and change them; their sum is the MOF's VO amount. */
export function VoSheet({ vos, canEdit, ...rest }: VoSheetProps) {
  const voTotal = sumRm(vos.map((vo) => vo.amount));
  const dialog: Omit<DialogProps, "vo"> = {
    ...rest,
    nextVoNo: `VO${vos.length + 1}`,
    voTotal,
    voCount: vos.length,
  };
  const nameOf = new Map(
    rest.supervisors.map((person) => [person.id, person.name]),
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <CardTitle className="font-heading">
            Variation orders ({vos.length})
          </CardTitle>
          {vos.length > 0 && (
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {formatRm(voTotal)}
            </span>
          )}
        </div>
        {canEdit && <VoDialog {...dialog} />}
      </CardHeader>
      <CardContent>
        <DataTable
          rows={vos}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              title="No VO yet"
              description="Additional work or omissions after the LOA are added here."
            />
          }
          columns={[
            {
              key: "voNo",
              header: "VO no.",
              cell: (row) => (
                <span className="font-mono font-medium">{row.voNo}</span>
              ),
            },
            {
              key: "confirmedOn",
              header: "Confirmed",
              numeric: true,
              cell: (row) => formatDate(row.confirmedOn),
            },
            {
              key: "amount",
              header: "Amount",
              numeric: true,
              cell: (row) => (
                <span className={row.amount < 0 ? "text-bad" : undefined}>
                  {formatRm(row.amount)}
                </span>
              ),
            },
            ...(rest.showCost
              ? [
                  {
                    key: "cost",
                    header: "Cost",
                    numeric: true,
                    cell: (row: VariationOrderRow) =>
                      row.cost === null ? "–" : formatRm(row.cost),
                  },
                ]
              : []),
            {
              key: "description",
              header: "What",
              cell: (row) => (
                <div className="flex flex-col gap-1">
                  <span>
                    {row.description}
                    {row.qty && ` · ${row.qty}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[row.clientRef, row.needsWork ? "With site work" : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <AlertStatus alerts={row.alerts} nameOf={nameOf} />
                </div>
              ),
            },
            ...(canEdit
              ? [
                  {
                    key: "edit",
                    header: "",
                    cell: (row: VariationOrderRow) => (
                      <VoDialog {...dialog} vo={row} />
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
