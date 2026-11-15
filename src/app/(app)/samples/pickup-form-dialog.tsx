"use client";

import { FileText, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
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
import type { TeamMember } from "@/lib/auth/team-directory";
import {
  formatSampleQty,
  PICKUP_MAX_LINES,
  PICKUP_METHOD_LABEL,
  PICKUP_METHODS,
  type PickupMethod,
  pickupShortfalls,
  SAMPLE_UNITS,
  type SampleUnit,
} from "@/lib/domain/samples";
import { isOneOf } from "@/lib/form/one-of";
import { savePickupForm } from "./pickup-actions";
import { useSampleSelection } from "./sample-selection";

/** What the form needs to know about a listed sample. */
export type PickupSampleOption = {
  id: string;
  /** What is printed as the product name: the SKU, else the product name. */
  label: string;
  name: string;
  brand: string;
  spec: string;
  unit: SampleUnit;
  qty: number;
};

type Row = {
  key: number;
  name: string;
  spec: string;
  qty: string;
  unit: SampleUnit;
  remarks: string;
};

type PickupFormDialogProps = {
  samples: readonly PickupSampleOption[];
  team: readonly TeamMember[];
  meName: string;
  /** Today in Malaysia, the appointment date to start with. */
  today: string;
  /** "header": opens a blank form (or the ticked samples). "toolbar": only shown with ticks. */
  placement: "header" | "toolbar";
};

/** The Best Link pickup form: numbered, printed as a signature receipt, and it takes the samples out of Best Link. */
export function PickupFormDialog(props: PickupFormDialogProps) {
  const [open, setOpen] = useState(false);
  const { ticked } = useSampleSelection();

  if (props.placement === "toolbar" && ticked.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {props.placement === "header" ? (
          <Button>
            <FileText data-icon="inline-start" />
            New pickup form
          </Button>
        ) : (
          <Button size="sm">
            <FileText data-icon="inline-start" />
            Pickup form with ticked ({ticked.length})
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Best Link pickup form</DialogTitle>
          <DialogDescription>
            Fill in and save. Then Print / Save as PDF and WhatsApp it to Best
            Link. Saving takes the listed samples out of Best Link.
          </DialogDescription>
        </DialogHeader>
        <PickupForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

const NOT_SET = "none";

function PickupForm({ samples, team, meName, today }: PickupFormDialogProps) {
  const router = useRouter();
  const { ticked, clear } = useSampleSelection();
  const nextKey = useRef(0);
  const blank = (): Row => ({
    key: nextKey.current++,
    name: "",
    spec: "",
    qty: "1",
    unit: "pc",
    remarks: "",
  });
  const [rows, setRows] = useState<Row[]>(() => {
    const picked = samples.filter(
      (sample) => ticked.includes(sample.id) && sample.qty > 0,
    );
    return picked.length > 0
      ? picked.map((sample) => ({
          ...blank(),
          name: sample.label,
          spec: sample.spec,
          unit: sample.unit,
        }))
      : [blank()];
  });
  const [personInCharge, setPersonInCharge] = useState(meName);
  const [contact, setContact] = useState("");
  const [method, setMethod] = useState<PickupMethod>("lalamove");
  const [appointmentOn, setAppointmentOn] = useState(today);
  const [driverContact, setDriverContact] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [address, setAddress] = useState("");
  const [takenBy, setTakenBy] = useState(NOT_SET);
  const [forWhom, setForWhom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A row naming one sample in the list (by what is printed) takes it out of Best Link.
  const byLabel = useMemo(() => {
    const found = new Map<string, PickupSampleOption[]>();
    for (const sample of samples) {
      const key = sample.label.toUpperCase();
      found.set(key, [...(found.get(key) ?? []), sample]);
    }
    return found;
  }, [samples]);
  const matchOf = (row: Row) => {
    const matches = byLabel.get(row.name.trim().toUpperCase()) ?? [];
    return {
      sample: matches.length === 1 ? matches[0] : null,
      ambiguous: matches.length > 1,
    };
  };

  const change = (key: number, fields: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...fields } : row)),
    );

  function changeName(row: Row, name: string) {
    const { sample } = matchOf({ ...row, name });
    change(row.key, {
      name,
      // A listed sample brings its size, and its unit is fixed (the stock counts in it).
      ...(sample ? { spec: row.spec || sample.spec, unit: sample.unit } : {}),
    });
  }

  function save() {
    const filled = rows.filter((row) => row.name.trim() !== "");
    const lines = filled.map((row) => ({
      sampleId: matchOf(row).sample?.id ?? null,
      productName: row.name,
      spec: row.spec,
      qty: row.qty,
      unit: row.unit,
      remarks: row.remarks,
    }));

    const atBestLink = new Map(
      samples.map((sample) => [sample.id, sample.qty]),
    );
    const short = pickupShortfalls(
      lines.map((line) => ({ sampleId: line.sampleId, qty: Number(line.qty) })),
      atBestLink,
    )[0];
    if (short) {
      const sample = samples.find((item) => item.id === short.sampleId);
      setError(
        `Only ${formatSampleQty(short.atBestLink, sample?.unit ?? "pc")} of ${sample?.label ?? "this sample"} at Best Link.`,
      );
      return;
    }

    startTransition(async () => {
      const result = await savePickupForm({
        personInCharge,
        contact,
        method,
        appointmentOn,
        driverContact,
        vehicleNo,
        address,
        takenBy: takenBy === NOT_SET ? "" : takenBy,
        forWhom,
        lines,
      });
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      clear();
      toast.success("Pickup form saved.");
      router.push(`/samples/pickup/${result.pickupId}`);
    });
  }

  return (
    <FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="pickupPic">Person in charge</FieldLabel>
          <Input
            id="pickupPic"
            value={personInCharge}
            onChange={(event) => setPersonInCharge(event.target.value)}
            maxLength={120}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pickupContact">Contact</FieldLabel>
          <Input
            id="pickupContact"
            inputMode="tel"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            maxLength={60}
            placeholder="e.g. 012-3723925"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pickupMethod">Delivery method</FieldLabel>
          <Select
            value={method}
            onValueChange={(value) => {
              if (isOneOf(PICKUP_METHODS, value)) setMethod(value);
            }}
          >
            <SelectTrigger id="pickupMethod">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PICKUP_METHODS.map((value) => (
                <SelectItem key={value} value={value}>
                  {PICKUP_METHOD_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="pickupDate">Appointment date</FieldLabel>
          <Input
            id="pickupDate"
            type="date"
            value={appointmentOn}
            onChange={(event) => setAppointmentOn(event.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pickupDriver">Driver contact</FieldLabel>
          <Input
            id="pickupDriver"
            inputMode="tel"
            value={driverContact}
            onChange={(event) => setDriverContact(event.target.value)}
            maxLength={60}
            placeholder="Can fill later"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pickupVehicle">Vehicle no.</FieldLabel>
          <Input
            id="pickupVehicle"
            value={vehicleNo}
            onChange={(event) => setVehicleNo(event.target.value)}
            maxLength={30}
            placeholder="Can fill later"
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="pickupAddress">Address (optional)</FieldLabel>
        <Input
          id="pickupAddress"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          maxLength={300}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <h3 className="font-heading text-sm font-semibold">Items</h3>
        {rows.map((row, index) => {
          const { sample, ambiguous } = matchOf(row);
          return (
            <div key={row.key} className="rounded-lg border p-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
                <div className="col-span-2 sm:col-span-3">
                  <FieldLabel className="text-xs">
                    {index + 1}. Product name
                  </FieldLabel>
                  <Input
                    value={row.name}
                    list="pickupSampleLabels"
                    onChange={(event) => changeName(row, event.target.value)}
                    maxLength={120}
                    placeholder="e.g. 37,PRI-04"
                    aria-label={`Product name, row ${index + 1}`}
                  />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <FieldLabel className="text-xs">Specification</FieldLabel>
                  <Input
                    value={row.spec}
                    onChange={(event) =>
                      change(row.key, { spec: event.target.value })
                    }
                    maxLength={120}
                    placeholder="e.g. (37) 25×100cm"
                  />
                </div>
                <div className="sm:col-span-1">
                  <FieldLabel className="text-xs">Qty</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    className="font-mono"
                    value={row.qty}
                    onChange={(event) =>
                      change(row.key, { qty: event.target.value })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel className="text-xs">Unit</FieldLabel>
                  <Select
                    value={sample ? sample.unit : row.unit}
                    disabled={Boolean(sample)}
                    onValueChange={(value) => {
                      if (isOneOf(SAMPLE_UNITS, value)) {
                        change(row.key, { unit: value });
                      }
                    }}
                  >
                    <SelectTrigger aria-label="Unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SAMPLE_UNITS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <FieldLabel className="text-xs">Remarks</FieldLabel>
                  <Input
                    value={row.remarks}
                    onChange={(event) =>
                      change(row.key, { remarks: event.target.value })
                    }
                    maxLength={120}
                  />
                </div>
                <div className="col-span-2 flex items-end justify-end sm:col-span-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove row"
                    onClick={() =>
                      setRows((current) =>
                        current.length > 1
                          ? current.filter((other) => other.key !== row.key)
                          : [blank()],
                      )
                    }
                  >
                    <X />
                  </Button>
                </div>
              </div>
              {sample && (
                <p
                  className={`mt-1 text-xs ${Number(row.qty) > sample.qty ? "text-bad" : "text-muted-foreground"}`}
                >
                  In sample list: {sample.name || sample.label}
                  {sample.brand && ` · ${sample.brand}`} · at Best Link{" "}
                  {formatSampleQty(sample.qty, sample.unit)}
                </p>
              )}
              {ambiguous && (
                <p className="mt-1 text-xs text-warn">
                  More than one sample has this SKU, so none is taken out of
                  Best Link. Take it out from the list instead.
                </p>
              )}
            </div>
          );
        })}
        <datalist id="pickupSampleLabels">
          {samples.map((sample) => (
            <option key={sample.id} value={sample.label}>
              {sample.name} · {sample.brand}
            </option>
          ))}
        </datalist>
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={rows.length >= PICKUP_MAX_LINES}
            onClick={() => setRows((current) => [...current, blank()])}
          >
            <Plus data-icon="inline-start" />
            Add row
          </Button>
          {rows.length >= PICKUP_MAX_LINES && (
            <span className="ml-2 text-xs text-muted-foreground">
              The form takes {PICKUP_MAX_LINES} rows.
            </span>
          )}
        </div>
      </div>

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          For our record (optional, not printed)
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pickupTakenBy">Taken by</FieldLabel>
            <Select value={takenBy} onValueChange={setTakenBy}>
              <SelectTrigger id="pickupTakenBy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NOT_SET}>Not set</SelectItem>
                {team.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="pickupFor">For (client / project)</FieldLabel>
            <Input
              id="pickupFor"
              value={forWhom}
              onChange={(event) => setForWhom(event.target.value)}
              maxLength={200}
            />
            <FieldDescription>
              Shown in each sample's history with the form number.
            </FieldDescription>
          </Field>
        </div>
      </details>

      {error && <FieldError>{error}</FieldError>}
      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving..." : "Save & open PDF form"}
      </Button>
    </FieldGroup>
  );
}
