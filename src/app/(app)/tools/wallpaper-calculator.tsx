"use client";

import { useState } from "react";
import { FieldDescription, FieldTitle } from "@/components/ui/field";
import {
  calculateWallpaper,
  WALLPAPER_TYPES,
  type WallpaperTypeName,
} from "@/lib/domain/wallpaper-calc";
import { useT } from "@/lib/i18n/language-context";
import {
  CalculatorLayout,
  CalculatorPanel,
  ChoiceButtons,
  WorkingTable,
} from "./calculator-parts";
import { formatDecimal as fx, readNumber } from "./format-decimal";
import { NumberField } from "./number-field";

const SQFT_PER_M2 = 10.7639;
const TYPE_NAMES = WALLPAPER_TYPES.map((type) => type.name);

/** Wallpaper: panels first, then the cutting height; never by wall area alone. */
export function WallpaperCalculator() {
  const t = useT();
  const [type, setType] = useState<WallpaperTypeName>("Korean");
  const [wallWidth, setWallWidth] = useState("8");
  const [wallHeight, setWallHeight] = useState("2.8");
  const [allowance, setAllowance] = useState("0.1");
  const [paperWidth, setPaperWidth] = useState("");
  const [rollLength, setRollLength] = useState("");

  const standard =
    WALLPAPER_TYPES.find((candidate) => candidate.name === type) ??
    WALLPAPER_TYPES[0];
  const byRoll = standard.sale === "roll";
  const result = calculateWallpaper({
    type,
    wallWidth: readNumber(wallWidth),
    wallHeight: readNumber(wallHeight),
    allowance: readNumber(allowance),
    paperWidth: readNumber(paperWidth),
    rollLength: readNumber(rollLength),
  });

  const quantity = result.sale === "roll" ? result.rolls : result.metres;
  const unit =
    result.sale === "roll"
      ? quantity === 1
        ? t("roll")
        : t("rolls")
      : quantity === 1
        ? t("running metre")
        : t("running metres");

  const working = [
    {
      label: t("Cutting height"),
      value: (
        <>
          {fx(readNumber(wallHeight))} + {fx(readNumber(allowance))} ={" "}
          <b>{fx(result.cutHeight)} m</b>
        </>
      ),
    },
    {
      label: t("Panels (drops)"),
      value: (
        <>
          {fx(readNumber(wallWidth))} ÷ {fx(result.width)} → {t("round up")} ={" "}
          <b>{result.panels}</b>
        </>
      ),
    },
    {
      label: t("Length needed"),
      value: (
        <>
          {result.panels} × {fx(result.cutHeight)} ={" "}
          <b>{fx(result.lengthNeeded)} m</b>
        </>
      ),
    },
    ...(result.sale === "roll"
      ? [
          {
            label: t("Panels per roll"),
            value: (
              <>
                {fx(result.rollLength)} ÷ {fx(result.cutHeight)} →{" "}
                {t("round down")} = <b>{result.panelsPerRoll}</b>
              </>
            ),
          },
          {
            label: t("Rolls to order"),
            value: (
              <>
                {result.panels} ÷ {result.panelsPerRoll || "–"} →{" "}
                {t("round up")} = <b>{result.rolls ?? "–"}</b>
              </>
            ),
          },
          ...(result.rolls
            ? [{ label: t("Off-cut left"), value: `${fx(result.offcut)} m` }]
            : []),
        ]
      : [
          {
            label: t("Order"),
            value: (
              <>
                {fx(result.lengthNeeded)} m → {t("round up")} ={" "}
                <b>{result.metres} m</b>
              </>
            ),
          },
        ]),
  ];

  return (
    <CalculatorLayout>
      <CalculatorPanel title={t("Key in")}>
        <div className="flex flex-col gap-2">
          <FieldTitle>{t("Wallpaper type")}</FieldTitle>
          <ChoiceButtons
            label={t("Wallpaper type")}
            choices={TYPE_NAMES}
            chosen={type}
            onChoose={setType}
          />
          <FieldDescription>
            {standard.name}: {standard.width} m {t("wide")} ·{" "}
            {byRoll && standard.rollLength !== null
              ? `${standard.rollLength} m ${t("per roll")} · ${t("ordered by full roll")}`
              : t("ordered by running metre (cut roll)")}
          </FieldDescription>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t("Wall width (m)")}
            value={wallWidth}
            onChange={setWallWidth}
          />
          <NumberField
            label={t("Net wall height (m)")}
            value={wallHeight}
            onChange={setWallHeight}
          />
          <NumberField
            label={t("Height allowance (m)")}
            value={allowance}
            onChange={setAllowance}
          />
          <NumberField
            label={t("Wallpaper width (m)")}
            value={paperWidth}
            onChange={setPaperWidth}
            placeholder={String(standard.width)}
          />
          {byRoll ? (
            <NumberField
              label={t("Roll length (m)")}
              value={rollLength}
              onChange={setRollLength}
              placeholder={String(standard.rollLength)}
            />
          ) : null}
        </div>
        <FieldDescription>
          {t(
            "Leave wallpaper width / roll length empty to use the standard size. Change them if the product is different.",
          )}
        </FieldDescription>
      </CalculatorPanel>

      <CalculatorPanel title={t("Order")}>
        <div>
          {quantity === null ? (
            <p className="font-heading text-3xl font-bold text-bad">
              {t("Check height")}
            </p>
          ) : (
            <p className="font-mono text-3xl font-bold tabular-nums">
              {quantity} {unit}
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {quantity === null
              ? t("The cutting height is longer than one roll.")
              : quantity > 0
                ? `${fx(result.area)} m² · ${fx(result.area * SQFT_PER_M2)} ${t("sq ft ordered")}`
                : null}
          </p>
        </div>
        <WorkingTable rows={working} />
        <p className="text-sm text-muted-foreground">
          {t(
            "Rule: work out panels first, then × cutting height. Never by wall area only.",
          )}{" "}
          {byRoll
            ? t("Full rolls: each roll only gives whole full-height panels.")
            : t("Fabric back is cut to the running metre, not full roll.")}
        </p>
      </CalculatorPanel>
    </CalculatorLayout>
  );
}
