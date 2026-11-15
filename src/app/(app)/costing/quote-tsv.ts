import { roundQuantity } from "@/lib/format/quantity";
import type { ClientLine, ClientOption } from "./quote-client-view";

/** Tabs and line breaks would split a spreadsheet cell, so they become spaces. */
const cell = (text: string): string => text.replace(/[\t\r\n]+/g, " ").trim();

const quantity = (value: number): string => String(roundQuantity(value));
const money = (value: number): string => value.toFixed(2);

function singleOption(option: ClientOption): string {
  const head = [
    "Item",
    "Product & Sku",
    "Description",
    "Qty",
    "Unit",
    "Rate",
    "Amount",
  ];
  const rows = option.lines.map((line) => [
    String(line.no),
    cell(line.product),
    cell(line.detail.join(" | ")),
    quantity(line.qty),
    line.unit,
    money(line.rate),
    money(line.amount),
  ]);
  const total = ["", "", "", "", "", "total", money(option.total)];
  return [head, ...rows, total].map((row) => row.join("\t")).join("\n");
}

const compareProduct = (line: ClientLine): string => cell(line.product);

function compareOptions(options: ClientOption[]): string {
  const head = [
    "S.NO",
    ...options.flatMap((option) => [
      `Option ${option.key} Product`,
      "Qty",
      "Unit",
      "Rate (RM)",
      "Amount (RM)",
    ]),
  ];
  const rowCount = Math.max(...options.map((option) => option.lines.length));
  const rows = Array.from({ length: rowCount }, (_, index) => [
    String(index + 1),
    ...options.flatMap((option) => {
      const line = option.lines[index];
      return line
        ? [
            compareProduct(line),
            quantity(line.qty),
            line.unit,
            money(line.rate),
            money(line.amount),
          ]
        : ["", "", "", "", ""];
    }),
  ]);
  const total = [
    "TOTAL",
    ...options.flatMap((option) => ["", "", "", "", money(option.total)]),
  ];
  return [head, ...rows, total].map((row) => row.join("\t")).join("\n");
}

/** The quote as tab-separated text to paste into Excel: one option, or all options side by side. */
export function quoteTsv(options: ClientOption[]): string {
  const [only, ...others] = options;
  if (!only) return "";
  return others.length === 0 ? singleOption(only) : compareOptions(options);
}
