import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A titled box in a calculator: "Key in" or "Order". */
export function CalculatorPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

/** The two boxes side by side on a wide screen, stacked on a phone. */
export function CalculatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid items-start gap-4 md:grid-cols-2">{children}</div>
  );
}

/** Working lines: a label and the sum that gives the figure. */
export function WorkingTable({
  rows,
}: {
  rows: readonly { label: string; value: ReactNode }[];
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t first:border-t-0">
            <td className="py-1.5 pr-3 text-muted-foreground">{row.label}</td>
            <td className="py-1.5 text-right font-mono tabular-nums">
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A pressable choice in a row of choices, e.g. the wallpaper type. */
export function ChoiceButtons<Choice extends string | number>({
  label,
  choices,
  chosen,
  onChoose,
  render = String,
}: {
  label: string;
  choices: readonly Choice[];
  chosen: Choice;
  onChoose: (choice: Choice) => void;
  render?: (choice: Choice) => string;
}) {
  return (
    <fieldset className="flex w-fit max-w-full min-w-0 flex-wrap gap-1 rounded-lg border-0 bg-muted p-1">
      <legend className="sr-only">{label}</legend>
      {choices.map((choice) => (
        <button
          key={choice}
          type="button"
          aria-pressed={choice === chosen}
          onClick={() => onChoose(choice)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
            choice === chosen
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {render(choice)}
        </button>
      ))}
    </fieldset>
  );
}
