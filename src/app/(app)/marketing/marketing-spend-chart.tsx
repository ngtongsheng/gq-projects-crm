import { formatMonth } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import { barLabel, type YearSummary } from "./marketing-dashboard";

// The theme has five chart colours. A sixth category and beyond reuse them, paler each lap, so
// two segments side by side never match (demo: one fixed palette cycling).
const PALETTE_SIZE = 5;
const LAP_OPACITY = [1, 0.6, 0.35];

function segmentStyle(index: number) {
  return {
    backgroundColor: `var(--chart-${(index % PALETTE_SIZE) + 1})`,
    opacity: LAP_OPACITY[Math.floor(index / PALETTE_SIZE)] ?? 0.2,
  };
}

const monthShort = (month: string) => formatMonth(`${month}-01`).slice(0, 3);

/**
 * Twelve stacked bars, one segment per category (demo mkChart). Plain CSS on theme tokens: no chart
 * library. The table above it holds the same numbers, so the bars only need a hover title.
 */
export function MarketingSpendChart({
  summary,
  t,
}: {
  summary: YearSummary;
  t: Translate;
}) {
  const peak = Math.max(1, ...summary.monthTotals);
  const legend = summary.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.total > 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-48 items-end gap-1.5 border-b px-1 pt-2 sm:gap-2">
        {summary.months.map((month, monthIndex) => {
          const total = summary.monthTotals[monthIndex];
          return (
            <div
              key={month}
              role="img"
              aria-label={`${formatMonth(`${month}-01`)}: ${formatRm(total)}`}
              title={`${formatMonth(`${month}-01`)}: ${formatRm(total)}`}
              className="flex min-w-0 flex-1 flex-col justify-end"
              style={{
                height: `calc(${total / peak} * (100% - 1.25rem) + 1.25rem)`,
              }}
            >
              <span className="h-5 text-center font-mono text-[10px] text-muted-foreground tabular-nums">
                {total > 0 ? barLabel(total) : ""}
              </span>
              <div className="flex min-h-0 flex-1 flex-col-reverse">
                {summary.rows.map((row, rowIndex) =>
                  row.months[monthIndex] > 0 ? (
                    <div
                      key={row.categoryId}
                      title={`${row.name}: ${formatRm(row.months[monthIndex])}`}
                      className="border-t border-card"
                      style={{
                        flexGrow: row.months[monthIndex],
                        flexBasis: 0,
                        ...segmentStyle(rowIndex),
                      }}
                    />
                  ) : null,
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 px-1 sm:gap-2">
        {summary.months.map((month) => (
          <span
            key={month}
            className="min-w-0 flex-1 text-center text-[11px] text-muted-foreground"
          >
            {monthShort(month)}
          </span>
        ))}
      </div>
      {legend.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          {t("No expense this year.")}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 pt-2 text-sm text-muted-foreground">
          {legend.map(({ row, index }) => (
            <li key={row.categoryId} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2.5 rounded-xs"
                style={segmentStyle(index)}
              />
              {row.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
