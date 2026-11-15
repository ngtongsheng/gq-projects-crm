"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/app/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldTitle } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  calculateVinyl,
  SKIRTING_HEIGHTS_MM,
  type SkirtingHeight,
  VINYL_SIDES,
  type VinylLayout,
  type VinylSide,
} from "@/lib/domain/vinyl-calc";
import { useT } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";
import {
  CalculatorLayout,
  CalculatorPanel,
  ChoiceButtons,
  WorkingTable,
} from "./calculator-parts";
import { formatDecimal as fx, readNumber } from "./format-decimal";
import { NumberField } from "./number-field";

/** Each wall, named as in the demo, with the floor measurement it runs along. */
const SIDE_LABEL: Record<
  VinylSide,
  { name: string; along: "length" | "width" }
> = {
  T: { name: "Top (A)", along: "length" },
  R: { name: "Right (B)", along: "width" },
  B: { name: "Bottom (C)", along: "length" },
  L: { name: "Left (D)", along: "width" },
};

function LayoutColumn({
  name,
  note,
  layout,
  rollLength,
  best,
}: {
  name: "A" | "B";
  note: string;
  layout: VinylLayout;
  rollLength: number;
  best: boolean;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border-2 p-3",
        best ? "border-good" : "border-border",
      )}
    >
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        {t("Direction")} {name}
        {best ? <StatusBadge tone="good">{t("Less vinyl")}</StatusBadge> : null}
      </p>
      <p className="text-xs text-muted-foreground">{note}</p>
      <p className="my-1.5 font-mono text-2xl font-bold tabular-nums">
        {fx(layout.orderLength)} lm
      </p>
      <WorkingTable
        rows={[
          {
            label: t("Drops"),
            value: `${layout.drops} × ${fx(layout.dropLength)} m`,
          },
          { label: t("Order area"), value: `${fx(layout.orderArea)} m²` },
          { label: t("Weld joints"), value: layout.weldJoints },
          { label: t("Welding rod"), value: `${fx(layout.weldingRod)} m` },
          {
            label: `${t("Of a")} ${fx(rollLength, 0)} m ${t("roll")}`,
            value: `${fx(layout.rolls)} ${t("roll")}`,
          },
        ]}
      />
    </div>
  );
}

/** Vinyl sheet: drops across the length (A) or the width (B), whichever uses less vinyl. */
export function VinylCalculator() {
  const t = useT();
  const [length, setLength] = useState("4800");
  const [width, setWidth] = useState("2550");
  const [skirting, setSkirting] = useState<SkirtingHeight>(100);
  const [rollWidth, setRollWidth] = useState("2000");
  const [rollLength, setRollLength] = useState("20");
  const [sides, setSides] = useState<Partial<Record<VinylSide, boolean>>>({
    T: true,
    L: true,
  });

  const floor = { length: readNumber(length), width: readNumber(width) };
  const result = calculateVinyl({
    ...floor,
    skirting,
    rollWidth: readNumber(rollWidth),
    rollLength: readNumber(rollLength),
    sides,
  });
  const rollLengthUsed = readNumber(rollLength) || 20;

  return (
    <CalculatorLayout>
      <CalculatorPanel title={t("Key in")}>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={`${t("Floor length")} (mm)`}
            value={length}
            onChange={setLength}
            step="1"
          />
          <NumberField
            label={`${t("Floor width")} (mm)`}
            value={width}
            onChange={setWidth}
            step="1"
          />
        </div>
        <div className="flex flex-col gap-2">
          <FieldTitle>{t("Skirting height (mm)")}</FieldTitle>
          <ChoiceButtons
            label={t("Skirting height (mm)")}
            choices={SKIRTING_HEIGHTS_MM}
            chosen={skirting}
            onChoose={setSkirting}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={`${t("Roll width")} (mm)`}
            value={rollWidth}
            onChange={setRollWidth}
            step="1"
          />
          <NumberField
            label={`${t("Roll length")} (m)`}
            value={rollLength}
            onChange={setRollLength}
            step="1"
          />
        </div>
        <div className="flex flex-col gap-2">
          <FieldTitle>{t("Skirting on which side?")}</FieldTitle>
          <div className="grid grid-cols-2 gap-1.5">
            {VINYL_SIDES.map((side) => (
              <Label
                key={side}
                className="gap-2 rounded-lg border p-2 font-normal"
              >
                <Checkbox
                  checked={sides[side] === true}
                  onCheckedChange={(checked) =>
                    setSides((current) => ({
                      ...current,
                      [side]: checked === true,
                    }))
                  }
                />
                {t(SIDE_LABEL[side].name)}
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {fx(floor[SIDE_LABEL[side].along] / 1000)} m
                </span>
              </Label>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("Coverage incl. skirting")}: {fx(result.coverageLength / 1000)} ×{" "}
          {fx(result.coverageWidth / 1000)} m
        </p>
      </CalculatorPanel>

      <CalculatorPanel title={t("Order")}>
        <div className="grid grid-cols-2 gap-2.5">
          <LayoutColumn
            name="A"
            note={t("Drops across the length")}
            layout={result.layoutA}
            rollLength={rollLengthUsed}
            best={result.lessVinyl === "A"}
          />
          <LayoutColumn
            name="B"
            note={t("Drops across the width")}
            layout={result.layoutB}
            rollLength={rollLengthUsed}
            best={result.lessVinyl === "B"}
          />
        </div>
        <WorkingTable
          rows={[
            {
              label: t("Recommended"),
              value: (
                <span className="whitespace-normal">
                  {result.lessVinyl
                    ? `${t("Direction")} ${result.lessVinyl} ${t("uses less vinyl")}`
                    : t("Same vinyl quantity")}
                  {result.lessRod
                    ? ` · ${t("Direction")} ${result.lessRod} ${t("uses less welding rod")}`
                    : ""}
                </span>
              ),
            },
            {
              label: t("Cove former"),
              value: <b>{fx(result.skirtingLength)} m</b>,
            },
            {
              label: t("Capping strip"),
              value: <b>{fx(result.skirtingLength)} m</b>,
            },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          {t(
            "Drops = coverage ÷ roll width, round up. Order length = drops × length per drop. Weld joints = drops − 1. Cove former & capping strip = total length of the sides with skirting.",
          )}
        </p>
      </CalculatorPanel>
    </CalculatorLayout>
  );
}
