"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { formatSampleQty, movesStillOut } from "@/lib/domain/samples";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { formatDate } from "@/lib/format/date";
import { returnSamples, takeOutSample } from "./sample-actions";
import type { SampleRow } from "./samples-data";

const sampleTitle = (sample: SampleRow) =>
  [sample.sku, sample.name].filter(Boolean).join(" ");

/** A sample leaves Best Link: to a salesperson, a client or a showroom. The quantity goes down. */
export function TakeOutSampleDialog({
  sample,
  team,
  meId,
}: {
  sample: SampleRow;
  team: readonly TeamMember[];
  meId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [takenBy, setTakenBy] = useState(
    team.some((member) => member.id === meId) ? meId : (team[0]?.id ?? ""),
  );
  const [clientKeeps, setClientKeeps] = useState(false);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await takeOutSample({
        sampleId: sample.id,
        qty: String(formData.get("qty") ?? ""),
        takenBy,
        forWhom: String(formData.get("forWhom") ?? ""),
        clientKeeps,
      });
      setError(result.error);
      if (!result.error) {
        toast.success(
          clientKeeps ? "Sample given to the client." : "Sample taken out.",
        );
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Take out
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Take out sample · {sampleTitle(sample)}</DialogTitle>
          <DialogDescription>
            At Best Link now: {formatSampleQty(sample.qty, sample.unit)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="takeOutQty">
                  Quantity ({sample.unit})
                </FieldLabel>
                <Input
                  id="takeOutQty"
                  name="qty"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max={sample.qty}
                  step="0.01"
                  className="font-mono"
                  defaultValue={1}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="takeOutBy">Taken by</FieldLabel>
                <Select value={takenBy} onValueChange={setTakenBy}>
                  <SelectTrigger id="takeOutBy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {team.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="takeOutFor">
                For (client / project / showroom)
              </FieldLabel>
              <Input
                id="takeOutFor"
                name="forWhom"
                maxLength={200}
                placeholder="e.g. SLA Architects – Alan"
              />
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="takeOutKeeps"
                checked={clientKeeps}
                onCheckedChange={(checked) => setClientKeeps(checked === true)}
              />
              <FieldLabel htmlFor="takeOutKeeps">
                Client keeps it (not coming back)
              </FieldLabel>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Take out"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Samples taken out come back to Best Link; the quantity goes up again. */
export function SampleBackDialog({
  sample,
  nameOf,
}: {
  sample: SampleRow;
  nameOf: ReadonlyMap<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const out = movesStillOut(sample.moves);
  const [ticked, setTicked] = useState<string[]>(out.map((move) => move.id));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    startTransition(async () => {
      const result = await returnSamples(sample.id, ticked);
      setError(result.error);
      if (!result.error) {
        toast.success("Sample back at Best Link.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setTicked(out.map((move) => move.id));
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Back
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sample back · {sampleTitle(sample)}</DialogTitle>
          <DialogDescription>Tick what came back.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {out.map((move) => (
            <Field key={move.id} orientation="horizontal">
              <Checkbox
                id={`back-${move.id}`}
                checked={ticked.includes(move.id)}
                onCheckedChange={(checked) =>
                  setTicked((current) =>
                    checked === true
                      ? [...current, move.id]
                      : current.filter((id) => id !== move.id),
                  )
                }
              />
              <FieldLabel htmlFor={`back-${move.id}`}>
                {formatSampleQty(move.qty, sample.unit)} ·{" "}
                {move.takenBy
                  ? (nameOf.get(move.takenBy) ?? "Unnamed")
                  : "Not set"}
                {move.forWhom ? ` (${move.forWhom})` : ""} · out{" "}
                {formatDate(move.movedOn)}
              </FieldLabel>
            </Field>
          ))}
          {error && <FieldError>{error}</FieldError>}
          <Button onClick={save} disabled={pending || ticked.length === 0}>
            {pending ? "Saving..." : "Back at Best Link"}
          </Button>
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
}
